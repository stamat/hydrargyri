import { isArray, stringToPrimitive, transformDashToCamelCase, getObjectValueByPath } from 'book-of-spells'

// Every tag defined through salis, so bind/handler scanning can tell which
// nested salis element owns a node: the nearest salis ancestor, whatever its tag.
const salisTags = new Set()

const BIND_TYPES = new Set(['text', 'html', 'value', 'attr'])

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
    this._initialized = false
    this._deferredInit = null
    this.handlers = Object.assign({}, this.constructor.handlers)

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
    if (attribute) this._reflected[key] = attribute
    else if (!(key in this._state)) this._state[key] = null

    // A property assigned before upgrade sits as an own property that would
    // shadow this accessor; capture it and replay it through the setter.
    let preset
    if (Object.prototype.hasOwnProperty.call(this, key)) {
      preset = this[key]
      delete this[key]
    }

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
        this._state[key] = value
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
    this._scanBinds()
    this._scanHandlers()
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
        const event = trimmed.slice(0, colon).trim()
        const name = trimmed.slice(colon + 1).trim()
        const listener = (e) => this._handle(name, e)
        el.addEventListener(event, listener)
        this._listeners.push({ el, event, listener })
      }
    }
    collect(this)
    this.querySelectorAll('[on],[data-on]').forEach(collect)
  }

  _teardownHandlers() {
    for (const { el, event, listener } of this._listeners) el.removeEventListener(event, listener)
    this._listeners = []
  }

  // A method wins over the handlers registry, and only one runs — first
  // match, so a registry entry cannot double-fire behind a subclass method.
  _handle(name, e) {
    if (typeof this[name] === 'function') return this[name](e, this)
    if (typeof this.handlers[name] === 'function') return this.handlers[name](e, this)
    console.warn(`salis: <${this.tagName.toLowerCase()}> has no handler "${name}"`)
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
  }
  for (const hook of ['connected', 'disconnected', 'attributeChanged']) {
    if (typeof options[hook] === 'function') Salis.prototype[hook] = options[hook]
  }
  customElements.define(name, Salis)
  return Salis
}
