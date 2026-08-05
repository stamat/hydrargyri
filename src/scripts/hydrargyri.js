import { isArray, stringToPrimitive, transformDashToCamelCase, getObjectValueByPath } from 'book-of-spells'

// Every tag defined through hydrargyri, so bind/handler scanning can tell which
// nested hydrargyri element owns a node: the nearest hydrargyri ancestor, whatever its tag.
const hgTags = new Set()

const BIND_TYPES = new Set(['text', 'html', 'value', 'attr', 'prop', 'if', 'unless'])

// Types that name the thing they write into, and mean nothing without it.
const NAMED_BIND_TYPES = new Set(['attr', 'prop'])

// Instance fields the constructor assigns; an accessor over one of these would
// dismantle the machinery it rides on. Prototype members — hydrargyri's own API and
// natives like `title` — are caught by the `key in this` check at define time.
const RESERVED = new Set(['handlers', 'conditions', 'formatters', '_state', '_binds', '_listeners', '_reflected', '_subscriptions', '_assigned', '_initialized', '_deferredInit'])

// Every proxy reactive() hands out maps to its model's subscriber set here —
// which is also how the property setter tells a reactive model from a plain one.
const reactiveSubs = new WeakMap()

// `properties` comes as an array of names, or an object of name → class-wide
// default — the define-time form of share().
function propertyNames(properties) {
  return isArray(properties) ? properties : Object.keys(properties)
}

// Keys normalize to camelCase once, at the share/declaration boundary —
// everything downstream trusts _state's own spelling.
function camelKeys(obj) {
  const out = {}
  for (const key in obj) out[transformDashToCamelCase(key)] = obj[key]
  return out
}

// Only plain objects and arrays wrap: class instances (Date, Map, elements)
// break under a proxy because their methods reach for internal slots the
// proxy does not have.
function isPlainValue(value) {
  if (value === null || typeof value !== 'object') return false
  if (isArray(value)) return true
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

// `null` attribute means absent, `''` means present-without-value — the HTML
// boolean convention — so `<x-el active>` reads as `true`, not as an empty string.
function parseAttributeValue(raw) {
  if (raw === null) return null
  if (raw === '') return true
  return stringToPrimitive(raw)
}

/**
 * Parse a `bind` attribute — `path[:type[#attr]][|formatter[:arg…]][;more]`,
 * type defaulting to text. A malformed entry warns and is skipped, so one typo
 * does not kill the element's other binds.
 *
 * A formatter's arguments are property paths resolved on the element at paint,
 * never literals — the attribute carries names, and names only.
 *
 * Exported for ecosystem packages that paint with the same grammar — the
 * parser lives here so the grammar cannot fork.
 *
 * @param {String} raw The attribute value
 * @returns {Array} Entries of `{ path, type, attr, format }` — paths split on
 *   `.`, format `{ name, args }` or null
 *
 * @example
 * parseBinds('user.name; price:value|money:currency')
 * // [{ path: ['user', 'name'], type: 'text', attr: null, format: null },
 * //  { path: ['price'], type: 'value', attr: null,
 * //    format: { name: 'money', args: [['currency']] } }]
 */
export function parseBinds(raw) {
  const entries = []
  for (const part of raw.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const pipes = trimmed.split('|')
    if (pipes.length > 2) {
      console.warn(`hydrargyri: unknown bind "${trimmed}" — one |formatter per entry, chaining is not supported`)
      continue
    }
    let format = null
    if (pipes.length === 2) {
      const segments = pipes[1].split(':').map((s) => s.trim())
      if (segments.some((s) => !s)) {
        console.warn(`hydrargyri: unknown bind "${trimmed}" — expected |formatter[:arg[:arg]]`)
        continue
      }
      format = { name: segments[0], args: segments.slice(1).map((arg) => arg.split('.')) }
    }
    const bindPart = pipes[0].trim()
    const colon = bindPart.indexOf(':')
    const pathPart = colon === -1 ? bindPart : bindPart.slice(0, colon)
    const typePart = colon === -1 ? '' : bindPart.slice(colon + 1)
    const path = pathPart.trim().split('.')
    let type = 'text'
    let attr = null
    if (typePart) {
      const hash = typePart.indexOf('#')
      type = (hash === -1 ? typePart : typePart.slice(0, hash)).trim()
      attr = hash === -1 ? null : typePart.slice(hash + 1).trim()
    }
    if (!BIND_TYPES.has(type) || (NAMED_BIND_TYPES.has(type) && !attr)) {
      console.warn(`hydrargyri: unknown bind "${trimmed}" — expected path[:text|html|value|attr#name|prop#name|if#condition|unless#condition]`)
      continue
    }
    // An if/unless bind paints nothing a formatter could shape — predicates on
    // the value are what conditions are for. The toggle still works.
    if (format && (type === 'if' || type === 'unless')) {
      console.warn(`hydrargyri: bind "${trimmed}" — a formatter cannot shape an ${type} bind, that is a condition's job; formatter ignored`)
      format = null
    }
    entries.push({ path, type, attr, format })
  }
  return entries
}

/**
 * Wrap a model in a deep proxy that repaints every hydrargyri element it is
 * assigned to on any mutation — the opt-in alternative to calling
 * `update(key)` after mutating a plain object.
 *
 * The proxy is the model: mutations to the raw original notify nobody.
 * Create the model reactive and use the returned proxy everywhere.
 *
 * @param {Object|Array} obj A plain object or array. Anything else —
 *   primitives, Maps, class instances — warns and comes back unwrapped.
 * @returns {Proxy} The reactive model, or `obj` as given when it cannot wrap
 *
 * @example
 * const user = reactive({ name: 'Aja' })
 * document.querySelector('user-card').user = user
 * user.name = 'Grace' // the card repaints
 */
export function reactive(obj) {
  if (reactiveSubs.has(obj)) return obj
  if (!isPlainValue(obj)) {
    console.warn('hydrargyri: reactive() takes a plain object or array — returned the value as given')
    return obj
  }
  const subs = new Set()
  const notify = () => { for (const fn of subs) fn() }
  // Per-model cache: a raw object reached twice through one model wraps once.
  // An object shared between two models gets a proxy per model, and notifies
  // only the model it was mutated through — the cost of having no dep tracking.
  const wrapped = new WeakMap()
  const wrap = (raw) => {
    if (wrapped.has(raw)) return wrapped.get(raw)
    const proxy = new Proxy(raw, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver)
        // A nested reactive model keeps its own subscribers rather than
        // joining this model's — assigning one inside another does not merge them.
        return isPlainValue(value) && !reactiveSubs.has(value) ? wrap(value) : value
      },
      set: (target, prop, value, receiver) => {
        const prev = target[prop]
        const ok = Reflect.set(target, prop, value, receiver)
        // Same-value writes stay silent — an array push still notifies twice
        // (index, then length), which is two cheap repaints, accepted.
        if (ok && !Object.is(prev, value)) notify()
        return ok
      },
      deleteProperty: (target, prop) => {
        const had = Object.prototype.hasOwnProperty.call(target, prop)
        const ok = Reflect.deleteProperty(target, prop)
        if (ok && had) notify()
        return ok
      }
    })
    reactiveSubs.set(proxy, subs)
    wrapped.set(raw, proxy)
    return proxy
  }
  return wrap(obj)
}

/**
 * Base class behind every hydrargyri element. Extend it directly when the element
 * needs methods of its own; otherwise the `hg()` factory is shorter.
 *
 * Subclasses override `connected`, `disconnected` and `attributeChanged` —
 * not the *Callback methods, which run the binding machinery.
 */
export class HgElement extends HTMLElement {
  /** Observed attributes, each becoming a reactive camelCase property reflected to the DOM. */
  static attributes = []
  /** Reactive properties that live only in JS, never written to an attribute — an array of names, or an object of name → class-wide default (define-time share). */
  static properties = []
  /** Named event handlers reachable from `on="event:name"`, shared by all instances. A key that is an exact `command` string (`'--add-item'`) also answers that Invoker Command, called as (event, element). */
  static handlers = {}
  /** Named predicates for `bind="key:if#name"` and `key:unless#name`, called as (value, element) at paint — truthy shows the node under `if`, hides it under `unless`. */
  static conditions = {}
  /** Named formatters for `bind="key|name[:arg…]"`, called as (value, element, ...args) at paint — the return value is what lands in the node. Args are property paths resolved on the element, never literals. */
  static formatters = {}

  static get observedAttributes() {
    return this.attributes
  }

  /**
   * Hand a value to every instance of this element, present and future —
   * the tag-wide form of `el.key = value`. Share a `reactive()` model and
   * every mutation reaches every instance from then on.
   *
   * Property keys only: an attribute-backed key is refused, because the
   * attribute is the markup's state, per instance by design. An instance
   * assignment outranks share on that instance, forever — reconnects included.
   *
   * @param {Object} values Map of property key → value
   *
   * @example
   * const Crew = hg('user-card', { properties: ['user'] })
   * Crew.share({ user: reactive({ name: 'Ada' }) })
   */
  static share(values) {
    const owned = new Set(propertyNames(this.properties).map(transformDashToCamelCase))
    const accepted = {}
    for (const key in values) {
      const name = transformDashToCamelCase(key)
      if (owned.has(name)) accepted[name] = values[key]
      else console.warn(`hydrargyri: share() takes declared properties — "${key}" ignored`)
    }
    this._shared = Object.assign({}, this._shared, accepted)
    if (!this._tag) return
    document.querySelectorAll(this._tag).forEach((el) => {
      if (typeof el._applyShared === 'function') el._applyShared(accepted)
    })
  }

  // Everything shared with this class: object-form property defaults under a
  // later share() of the same key — a runtime call overrides the declaration.
  static _sharedAll() {
    const declared = isArray(this.properties) ? null : camelKeys(this.properties)
    if (!declared && !this._shared) return null
    return Object.assign({}, declared, this._shared)
  }

  constructor() {
    super()
    // Lowercase, because selector matching against an uppercase custom
    // element tagName is not reliable everywhere (jsdom rejects it).
    hgTags.add(this.tagName.toLowerCase())
    // The class learns its tag from its first instance — share() sweeps by it.
    // Before any instance exists there is nothing in the document to sweep.
    this.constructor._tag = this.tagName.toLowerCase()
    this._state = {}
    this._binds = {}
    this._listeners = []
    this._reflected = {}
    this._subscriptions = []
    this._assigned = new Set()
    this._initialized = false
    this._deferredInit = null
    this.handlers = Object.assign({}, this.constructor.handlers)
    this.conditions = Object.assign({}, this.constructor.conditions)
    this.formatters = Object.assign({}, this.constructor.formatters)

    for (const attr of this.constructor.observedAttributes) this._defineAccessor(attr, attr)
    for (const prop of propertyNames(this.constructor.properties)) this._defineAccessor(prop, null)
  }

  connectedCallback() {
    if (this._initialized) return
    // During parse this fires before the element's children exist, so the
    // scan waits for the parser; any later connect sees a complete subtree.
    if (document.readyState === 'loading') {
      this._deferredInit = () => this._init()
      document.addEventListener('DOMContentLoaded', this._deferredInit, { once: true })
      return
    }
    this._init()
  }

  disconnectedCallback() {
    if (this._deferredInit) {
      document.removeEventListener('DOMContentLoaded', this._deferredInit)
      this._deferredInit = null
      return
    }
    if (!this._initialized) return
    this._teardownHandlers()
    this._teardownSubscriptions()
    // Not permanent teardown: a reconnect re-scans, so a moved element keeps working.
    this._initialized = false
    if (typeof this.disconnected === 'function') this.disconnected(this)
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // setAttribute fires this even when the value did not change; without the
    // guard a bind writing an observed attribute of its own element would loop.
    if (oldValue === newValue) return
    this.update(transformDashToCamelCase(name))
    // Standing down before init: attributes parsed from markup are initial
    // state, not changes. `connected` is where the element meets them.
    if (this._initialized && typeof this.attributeChanged === 'function') {
      this.attributeChanged(name, parseAttributeValue(oldValue), parseAttributeValue(newValue))
    }
  }

  /**
   * Repaint bound nodes — all of them, or only those bound to one key.
   * The escape hatch after mutating inside an object property, which no
   * setter sees: `el.user.name = 'x'; el.update('user')`.
   */
  update(key) {
    if (!this._initialized) return
    if (key) {
      this._applyBinds(key)
      return
    }
    for (const k in this._binds) this._applyBinds(k)
  }

  _defineAccessor(name, attribute) {
    const key = transformDashToCamelCase(name)
    // Colliding names fail loud here, at definition — not as a TypeError three
    // calls from the cause when `attributes: ['update']` has shadowed the API
    // or a native like `title` has silently lost its platform behaviour.
    if (RESERVED.has(key)) {
      console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> cannot observe "${name}" — "${key}" is reserved by hydrargyri`)
      return
    }

    // A property assigned before upgrade sits as an own property that would
    // shadow this accessor; capture it and replay it through the setter.
    let preset
    if (Object.prototype.hasOwnProperty.call(this, key)) {
      preset = this[key]
      delete this[key]
    }

    // After the preset is lifted, anything still answering to the name lives
    // on the prototype chain — hydrargyri API, subclass method, or platform native.
    if (key in this) {
      console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> cannot observe "${name}" — "${key}" already exists on the element`)
      return
    }

    if (attribute) this._reflected[key] = attribute
    else if (!(key in this._state)) this._state[key] = null

    // Reflected values are read from the attribute every time — the DOM is
    // the only copy, so devtools edits and hydrargyri writes cannot disagree.
    Object.defineProperty(this, key, attribute ? {
      get: () => parseAttributeValue(this.getAttribute(attribute)),
      set: (value) => {
        if (value === null || value === undefined || value === false) this.removeAttribute(attribute)
        else if (value === true) this.setAttribute(attribute, '')
        else this.setAttribute(attribute, value)
        // attributeChangedCallback repaints; nothing else to do here.
      }
    } : {
      get: () => this._state[key],
      set: (value) => {
        this._unsubscribe(key)
        this._state[key] = value
        // The mark is what lets an instance assignment outrank share() —
        // _applyShared erases it right after its own writes, so only the
        // author's assignments carry it.
        this._assigned.add(key)
        // Pre-init assignments subscribe in _init instead, so an element that
        // never initializes is not pinned in memory by a model's subscriber set.
        if (this._initialized) this._subscribe(key, value)
        this.update(key)
      }
    })

    if (preset !== undefined) this[key] = preset
  }

  // Runs through the property setters, then erases the assigned mark they
  // leave — share-applied values must stay overwritable by the next share().
  _applyShared(values) {
    for (const key in values) {
      if (!(key in this._state)) continue
      if (this._assigned.has(key)) continue
      this[key] = values[key]
      this._assigned.delete(key)
    }
  }

  _init() {
    this._deferredInit = null
    // Before _initialized: the setters store without subscribing, and the
    // subscribe scan below picks the models up exactly once.
    const shared = this.constructor._sharedAll()
    if (shared) this._applyShared(shared)
    this._initialized = true
    // Styling hook for the upgraded state: x-el:not([hg]) hides unbound markup.
    this.setAttribute('hg', '')
    // Reactive models assigned before init — including pre-upgrade presets —
    // subscribe here; disconnect tears down, so a reconnect resubscribes.
    for (const key in this._state) this._subscribe(key, this._state[key])
    this._scanBinds()
    this._scanHandlers()
    // Always wired, even with no command keys declared: a handler assigned at
    // runtime then routes without the author re-wiring anything. Registered
    // in _listeners after _scanHandlers, so teardown unhooks it with the rest.
    const listener = (e) => this._act(e)
    this.addEventListener('command', listener)
    this._listeners.push({ el: this, event: 'command', listener })
    this.update()
    if (typeof this.connected === 'function') this.connected(this)
  }

  // The nearest hydrargyri ancestor owns a node — any hydrargyri tag, not only this
  // element's own, so different hydrargyri elements nest without stealing binds.
  _scope(el) {
    return el.closest([...hgTags].join(',')) === this
  }

  _owns(key) {
    return key in this._reflected || key in this._state
  }

  _scanBinds() {
    this._binds = {}
    const collect = (el) => {
      if (!this._scope(el)) return
      const raw = el.getAttribute('bind') || el.getAttribute('data-bind')
      if (!raw) return
      for (const entry of parseBinds(raw)) {
        // A formatter argument names a dependency the same way the bind key
        // does, so the entry registers under every named key — repainting any
        // of them re-renders the node, with no dependency tracking anywhere.
        const keys = new Set([entry.path[0]])
        if (entry.format) for (const arg of entry.format.args) keys.add(arg[0])
        const unknown = [...keys].find((key) => !this._owns(key))
        if (unknown !== undefined) {
          console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> has no attribute or property "${unknown}" for bind "${raw}"`)
          continue
        }
        entry.el = el
        for (const key of keys) {
          if (!this._binds[key]) this._binds[key] = []
          this._binds[key].push(entry)
        }
      }
    }
    collect(this)
    this.querySelectorAll('[bind],[data-bind]').forEach(collect)
  }

  _scanHandlers() {
    this._teardownHandlers()
    const collect = (el) => {
      if (!this._scope(el)) return
      const raw = el.getAttribute('on') || el.getAttribute('data-on')
      if (!raw) return
      for (const part of raw.split(';')) {
        const trimmed = part.trim()
        if (!trimmed) continue
        const colon = trimmed.indexOf(':')
        if (colon === -1) {
          console.warn(`hydrargyri: unknown handler "${trimmed}" — expected event:name`)
          continue
        }
        let event = trimmed.slice(0, colon).trim()
        const name = trimmed.slice(colon + 1).trim()
        // resize@window / click@document put the listener on the global while
        // the handler stays this element's; stored in _listeners like any
        // other, so disconnect unhooks it and nothing can leak.
        let target = el
        const at = event.lastIndexOf('@')
        if (at !== -1) {
          const where = event.slice(at + 1)
          target = where === 'window' ? window : where === 'document' ? document : null
          if (!target) {
            console.warn(`hydrargyri: unknown handler target "${trimmed}" — expected event@window or event@document`)
            continue
          }
          event = event.slice(0, at)
        }
        const listener = (e) => this._handle(name, e)
        target.addEventListener(event, listener)
        this._listeners.push({ el: target, event, listener })
      }
    }
    collect(this)
    this.querySelectorAll('[on],[data-on]').forEach(collect)
  }

  _teardownHandlers() {
    for (const { el, event, listener } of this._listeners) el.removeEventListener(event, listener)
    this._listeners = []
  }

  _subscribe(key, value) {
    const subs = reactiveSubs.get(value)
    if (!subs) return
    const fn = () => this.update(key)
    subs.add(fn)
    this._subscriptions.push({ key, subs, fn })
  }

  // Leaving a stale subscription behind on reassignment would keep the old
  // model repainting this element — and keep the element alive — forever.
  _unsubscribe(key) {
    this._subscriptions = this._subscriptions.filter((sub) => {
      if (sub.key !== key) return true
      sub.subs.delete(sub.fn)
      return false
    })
  }

  _teardownSubscriptions() {
    for (const { subs, fn } of this._subscriptions) subs.delete(fn)
    this._subscriptions = []
  }

  // A method wins over the handlers registry, and only one runs — first
  // match, so a registry entry cannot double-fire behind a subclass method.
  _handle(name, e) {
    if (typeof this[name] === 'function') return this[name](e, this)
    if (typeof this.handlers[name] === 'function') return this.handlers[name](e, this)
    console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> has no handler "${name}"`)
  }

  // Commands look up handlers by the exact command string, dashes and all —
  // no name transformation to reason backwards through, and custom commands
  // must start with `--`, so command keys cannot collide with handler names.
  // Registry only, no method lookup: a subclass method must not become
  // command-invokable by its name alone. Unknown commands warn only when some
  // `--` key is declared, because commands may be handled by an `on` listener
  // instead; only a declared command key makes an unknown one a typo worth naming.
  _act(e) {
    const action = this.handlers[e.command]
    if (typeof action === 'function') return action(e, this)
    if (Object.keys(this.handlers).some((key) => key.startsWith('--'))) {
      console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> has no handler for command "${e.command}"`)
    }
  }

  _applyBinds(key) {
    const binds = this._binds[key]
    if (!binds) return
    for (const bind of binds) {
      // The repaint may arrive under a formatter argument's key; the painted
      // value always comes from the bind's own path.
      this._render(bind, this._resolve(bind.path))
    }
  }

  _resolve(path) {
    const value = this[path[0]]
    return path.length > 1 ? getObjectValueByPath(value, path.slice(1)) : value
  }

  _render({ el, type, attr, format }, value) {
    // undefined means a path into an object that is not there yet — leave the
    // node alone. null is a real value and clears.
    if (value === undefined) return
    if (format) {
      const formatter = this.formatters[format.name]
      // A missing formatter warns and paints the raw value — never hide state
      // over a typo. Warned at paint, not scan, because `formatters` is
      // assignable at runtime and may be filled in later.
      if (typeof formatter !== 'function') {
        console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> has no formatter "${format.name}"`)
      } else {
        value = formatter(value, this, ...format.args.map((arg) => this._resolve(arg)))
        if (value === undefined) return
      }
    }
    switch (type) {
      case 'text':
        el.textContent = value === null ? '' : value
        break
      case 'html':
        el.innerHTML = value === null ? '' : value
        break
      case 'value':
        el.value = value === null ? '' : value
        break
      case 'attr':
        if (value === null || value === false) el.removeAttribute(attr)
        else el.setAttribute(attr, value === true ? '' : value)
        break
      // No coercion and no absent state: an attribute can only hold a string,
      // which is why an array or an object reaching another element has to come
      // this way. `null` writes null, because a property has no "removed".
      case 'prop':
        el[attr] = value
        break
      case 'if':
      case 'unless': {
        let truth = value
        if (attr) {
          const condition = this.conditions[attr]
          // A missing condition warns and leaves the node as authored — hiding
          // content over a typo would be the silent kind of wrong.
          if (typeof condition !== 'function') {
            console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> has no condition "${attr}"`)
            break
          }
          truth = condition(value, this)
        }
        el.toggleAttribute('hidden', type === 'unless' ? !!truth : !truth)
        break
      }
    }
  }
}

/**
 * Define a custom element declaratively and return its class.
 *
 * @param {String} name Custom element tag name
 * @param {Object|Array} options Attributes, properties, handlers and lifecycle
 *   hooks — or just an array of attribute names.
 * @param {Array} [options.attributes] Observed attributes, reflected reactive properties
 * @param {Array|Object} [options.properties] Reactive properties without an attribute — an array of names, or an object of name → class-wide default (define-time share)
 * @param {Object} [options.handlers] Named handlers for `on="event:name"`, called as (event, element); a key that is an exact command string (`'--add-item'`) also answers that Invoker Command
 * @param {Object} [options.conditions] Named predicates for `bind="key:if#name"` and `key:unless#name`, called as (value, element) at paint — truthy shows the node under `if`, hides it under `unless`
 * @param {Object} [options.formatters] Named formatters for `bind="key|name[:arg…]"`, called as (value, element, ...args) at paint — the return value is what lands in the node; args are property paths resolved on the element, never literals
 * @param {Function} [options.connected] Runs once the element is upgraded, scanned and painted
 * @param {Function} [options.disconnected] Runs when the element leaves the DOM
 * @param {Function} [options.attributeChanged] Runs on observed attribute changes after init, as (name, oldValue, newValue)
 * @returns {typeof HgElement}
 *
 * @example
 * hg('user-card', {
 *   attributes: ['name'],
 *   handlers: { greet(e, el) { el.name = 'clicked' } }
 * })
 */
export default function hg(name, options = {}) {
  if (isArray(options)) options = { attributes: options }
  class Hg extends HgElement {
    static attributes = options.attributes || []
    static properties = options.properties || []
    static handlers = options.handlers || {}
    static conditions = options.conditions || {}
    static formatters = options.formatters || {}
  }
  for (const hook of ['connected', 'disconnected', 'attributeChanged']) {
    if (typeof options[hook] === 'function') Hg.prototype[hook] = options[hook]
  }
  customElements.define(name, Hg)
  return Hg
}

// The default import already takes whatever name the caller gives it; this is
// only what makes the named form `import { hydrargyri }` resolve.
export { hg as hydrargyri }
