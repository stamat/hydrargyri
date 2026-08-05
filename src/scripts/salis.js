import { isArray, stringToPrimitive, transformDashToCamelCase, getObjectValueByPath } from 'book-of-spells'

// Every tag defined through salis, so bind/handler scanning can tell which
// nested salis element owns a node: the nearest salis ancestor, whatever its tag.
const salisTags = new Set()

const BIND_TYPES = new Set(['text', 'html', 'value', 'attr'])

// Instance fields the constructor assigns; an accessor over one of these would
// dismantle the machinery it rides on. Prototype members — salis's own API and
// natives like `title` — are caught by the `key in this` check at define time.
const RESERVED = new Set(['handlers', 'actions', '_state', '_binds', '_listeners', '_reflected', '_subscriptions', '_initialized', '_deferredInit'])

// Every proxy reactive() hands out maps to its model's subscriber set here —
// which is also how the property setter tells a reactive model from a plain one.
const reactiveSubs = new WeakMap()

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

// bind="path[:type[#attr]][;more]" — type defaults to text. A malformed entry
// warns and is skipped, so one typo does not kill the element's other binds.
function parseBinds(raw) {
  const entries = []
  for (const part of raw.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const colon = trimmed.indexOf(':')
    const pathPart = colon === -1 ? trimmed : trimmed.slice(0, colon)
    const typePart = colon === -1 ? '' : trimmed.slice(colon + 1)
    const path = pathPart.trim().split('.')
    let type = 'text'
    let attr = null
    if (typePart) {
      const hash = typePart.indexOf('#')
      type = (hash === -1 ? typePart : typePart.slice(0, hash)).trim()
      attr = hash === -1 ? null : typePart.slice(hash + 1).trim()
    }
    if (!BIND_TYPES.has(type) || (type === 'attr' && !attr)) {
      console.warn(`salis: unknown bind "${trimmed}" — expected path[:text|html|value|attr#name]`)
      continue
    }
    entries.push({ path, type, attr })
  }
  return entries
}

/**
 * Wrap a model in a deep proxy that repaints every salis element it is
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
    console.warn('salis: reactive() takes a plain object or array — returned the value as given')
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
 * Base class behind every salis element. Extend it directly when the element
 * needs methods of its own; otherwise the `salis()` factory is shorter.
 *
 * Subclasses override `connected`, `disconnected` and `attributeChanged` —
 * not the *Callback methods, which run the binding machinery.
 */
export class SalisElement extends HTMLElement {
  /** Observed attributes, each becoming a reactive camelCase property reflected to the DOM. */
  static attributes = []
  /** Reactive properties that live only in JS, never written to an attribute. */
  static properties = []
  /** Named event handlers reachable from `on="event:name"`, shared by all instances. */
  static handlers = {}
  /** Invoker Command responses, keyed by the exact `command` string (`'--add-item'`), called as (event, element). */
  static actions = {}

  static get observedAttributes() {
    return this.attributes
  }

  constructor() {
    super()
    // Lowercase, because selector matching against an uppercase custom
    // element tagName is not reliable everywhere (jsdom rejects it).
    salisTags.add(this.tagName.toLowerCase())
    this._state = {}
    this._binds = {}
    this._listeners = []
    this._reflected = {}
    this._subscriptions = []
    this._initialized = false
    this._deferredInit = null
    this.handlers = Object.assign({}, this.constructor.handlers)
    this.actions = Object.assign({}, this.constructor.actions)

    for (const attr of this.constructor.observedAttributes) this._defineAccessor(attr, attr)
    for (const prop of this.constructor.properties) this._defineAccessor(prop, null)
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
      console.warn(`salis: <${this.tagName.toLowerCase()}> cannot observe "${name}" — "${key}" is reserved by salis`)
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
    // on the prototype chain — salis API, subclass method, or platform native.
    if (key in this) {
      console.warn(`salis: <${this.tagName.toLowerCase()}> cannot observe "${name}" — "${key}" already exists on the element`)
      return
    }

    if (attribute) this._reflected[key] = attribute
    else if (!(key in this._state)) this._state[key] = null

    // Reflected values are read from the attribute every time — the DOM is
    // the only copy, so devtools edits and salis writes cannot disagree.
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
        // Pre-init assignments subscribe in _init instead, so an element that
        // never initializes is not pinned in memory by a model's subscriber set.
        if (this._initialized) this._subscribe(key, value)
        this.update(key)
      }
    })

    if (preset !== undefined) this[key] = preset
  }

  _init() {
    this._deferredInit = null
    this._initialized = true
    // Styling hook for the upgraded state: x-el:not([salis]) hides unbound markup.
    this.setAttribute('salis', '')
    // Reactive models assigned before init — including pre-upgrade presets —
    // subscribe here; disconnect tears down, so a reconnect resubscribes.
    for (const key in this._state) this._subscribe(key, this._state[key])
    this._scanBinds()
    this._scanHandlers()
    // Always wired, even with no actions declared: an action assigned at
    // runtime then routes without the author re-wiring anything. Registered
    // in _listeners after _scanHandlers, so teardown unhooks it with the rest.
    const listener = (e) => this._act(e)
    this.addEventListener('command', listener)
    this._listeners.push({ el: this, event: 'command', listener })
    this.update()
    if (typeof this.connected === 'function') this.connected(this)
  }

  // The nearest salis ancestor owns a node — any salis tag, not only this
  // element's own, so different salis elements nest without stealing binds.
  _scope(el) {
    return el.closest([...salisTags].join(',')) === this
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
        const key = entry.path[0]
        if (!this._owns(key)) {
          console.warn(`salis: <${this.tagName.toLowerCase()}> has no attribute or property "${key}" for bind "${raw}"`)
          continue
        }
        entry.el = el
        if (!this._binds[key]) this._binds[key] = []
        this._binds[key].push(entry)
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
          console.warn(`salis: unknown handler "${trimmed}" — expected event:name`)
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
            console.warn(`salis: unknown handler target "${trimmed}" — expected event@window or event@document`)
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
    console.warn(`salis: <${this.tagName.toLowerCase()}> has no handler "${name}"`)
  }

  // Command issued, action taken. Keys are the exact command strings, dashes
  // and all — no name transformation to reason backwards through. An empty
  // registry stays silent, because commands may be handled by an `on` listener
  // instead; only a populated one makes an unknown command a typo worth naming.
  _act(e) {
    const action = this.actions[e.command]
    if (typeof action === 'function') return action(e, this)
    if (Object.keys(this.actions).length) {
      console.warn(`salis: <${this.tagName.toLowerCase()}> has no action for command "${e.command}"`)
    }
  }

  _applyBinds(key) {
    const binds = this._binds[key]
    if (!binds) return
    for (const bind of binds) {
      let value = this[key]
      if (bind.path.length > 1) value = getObjectValueByPath(value, bind.path.slice(1))
      this._render(bind, value)
    }
  }

  _render({ el, type, attr }, value) {
    // undefined means a path into an object that is not there yet — leave the
    // node alone. null is a real value and clears.
    if (value === undefined) return
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
 * @param {Array} [options.properties] Reactive properties without an attribute
 * @param {Object} [options.handlers] Named handlers for `on="event:name"`, called as (event, element)
 * @param {Object} [options.actions] Invoker Command responses keyed by the exact command string (`'--add-item'`), called as (event, element)
 * @param {Function} [options.connected] Runs once the element is upgraded, scanned and painted
 * @param {Function} [options.disconnected] Runs when the element leaves the DOM
 * @param {Function} [options.attributeChanged] Runs on observed attribute changes after init, as (name, oldValue, newValue)
 * @returns {typeof SalisElement}
 *
 * @example
 * salis('user-card', {
 *   attributes: ['name'],
 *   handlers: { greet(e, el) { el.name = 'clicked' } }
 * })
 */
export default function salis(name, options = {}) {
  if (isArray(options)) options = { attributes: options }
  class Salis extends SalisElement {
    static attributes = options.attributes || []
    static properties = options.properties || []
    static handlers = options.handlers || {}
    static actions = options.actions || {}
  }
  for (const hook of ['connected', 'disconnected', 'attributeChanged']) {
    if (typeof options[hook] === 'function') Salis.prototype[hook] = options[hook]
  }
  customElements.define(name, Salis)
  return Salis
}
