/* salis v1.0.0 | https://stamat.github.io/salis/ | MIT License */
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// node_modules/book-of-spells/src/helpers.mjs
function stringToBoolean(str) {
  if (/^\s*(true|false)\s*$/i.test(str)) return str.trim().toLowerCase() === "true";
}
function stringToNumber(str) {
  if (/^\s*-?\d+\s*$/.test(str)) return parseInt(str);
  if (/^\s*-?\d+\.\d+\s*$/.test(str)) return parseFloat(str);
}
function stringToPrimitive(str) {
  var _a;
  if (/^\s*null\s*$/.test(str)) return null;
  const bool = stringToBoolean(str);
  if (bool !== void 0) return bool;
  return (_a = stringToNumber(str)) != null ? _a : str;
}
function isArray(o) {
  return Array.isArray(o);
}
function transformDashToCamelCase(str) {
  return str.replace(/-([a-z])/g, function(g) {
    return g[1].toUpperCase();
  });
}
function getObjectValueByPath(obj, path) {
  if (typeof path === "string") path = path.split(".");
  return path.reduce((acc, part) => acc !== null && acc !== void 0 ? acc[part] : void 0, obj);
}

// src/scripts/salis.js
var salisTags = /* @__PURE__ */ new Set();
var BIND_TYPES = /* @__PURE__ */ new Set(["text", "html", "value", "attr"]);
var RESERVED = /* @__PURE__ */ new Set(["handlers", "actions", "_state", "_binds", "_listeners", "_reflected", "_subscriptions", "_assigned", "_initialized", "_deferredInit"]);
var reactiveSubs = /* @__PURE__ */ new WeakMap();
function isPlainValue(value) {
  if (value === null || typeof value !== "object") return false;
  if (isArray(value)) return true;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function parseAttributeValue(raw) {
  if (raw === null) return null;
  if (raw === "") return true;
  return stringToPrimitive(raw);
}
function parseBinds(raw) {
  const entries = [];
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    const pathPart = colon === -1 ? trimmed : trimmed.slice(0, colon);
    const typePart = colon === -1 ? "" : trimmed.slice(colon + 1);
    const path = pathPart.trim().split(".");
    let type = "text";
    let attr = null;
    if (typePart) {
      const hash = typePart.indexOf("#");
      type = (hash === -1 ? typePart : typePart.slice(0, hash)).trim();
      attr = hash === -1 ? null : typePart.slice(hash + 1).trim();
    }
    if (!BIND_TYPES.has(type) || type === "attr" && !attr) {
      console.warn(`salis: unknown bind "${trimmed}" \u2014 expected path[:text|html|value|attr#name]`);
      continue;
    }
    entries.push({ path, type, attr });
  }
  return entries;
}
function reactive(obj) {
  if (reactiveSubs.has(obj)) return obj;
  if (!isPlainValue(obj)) {
    console.warn("salis: reactive() takes a plain object or array \u2014 returned the value as given");
    return obj;
  }
  const subs = /* @__PURE__ */ new Set();
  const notify = () => {
    for (const fn of subs) fn();
  };
  const wrapped = /* @__PURE__ */ new WeakMap();
  const wrap = (raw) => {
    if (wrapped.has(raw)) return wrapped.get(raw);
    const proxy = new Proxy(raw, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);
        return isPlainValue(value) && !reactiveSubs.has(value) ? wrap(value) : value;
      },
      set: (target, prop, value, receiver) => {
        const prev = target[prop];
        const ok = Reflect.set(target, prop, value, receiver);
        if (ok && !Object.is(prev, value)) notify();
        return ok;
      },
      deleteProperty: (target, prop) => {
        const had = Object.prototype.hasOwnProperty.call(target, prop);
        const ok = Reflect.deleteProperty(target, prop);
        if (ok && had) notify();
        return ok;
      }
    });
    reactiveSubs.set(proxy, subs);
    wrapped.set(raw, proxy);
    return proxy;
  };
  return wrap(obj);
}
var SalisElement = class extends HTMLElement {
  static get observedAttributes() {
    return this.attributes;
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
   * const Crew = salis('user-card', { properties: ['user'] })
   * Crew.share({ user: reactive({ name: 'Ada' }) })
   */
  static share(values) {
    const owned = new Set(this.properties.map(transformDashToCamelCase));
    const accepted = {};
    for (const key in values) {
      if (owned.has(key)) accepted[key] = values[key];
      else console.warn(`salis: share() takes declared properties \u2014 "${key}" ignored`);
    }
    this._shared = Object.assign({}, this._shared, accepted);
    if (!this._tag) return;
    document.querySelectorAll(this._tag).forEach((el) => {
      if (typeof el._applyShared === "function") el._applyShared(accepted);
    });
  }
  constructor() {
    super();
    salisTags.add(this.tagName.toLowerCase());
    this.constructor._tag = this.tagName.toLowerCase();
    this._state = {};
    this._binds = {};
    this._listeners = [];
    this._reflected = {};
    this._subscriptions = [];
    this._assigned = /* @__PURE__ */ new Set();
    this._initialized = false;
    this._deferredInit = null;
    this.handlers = Object.assign({}, this.constructor.handlers);
    this.actions = Object.assign({}, this.constructor.actions);
    for (const attr of this.constructor.observedAttributes) this._defineAccessor(attr, attr);
    for (const prop of this.constructor.properties) this._defineAccessor(prop, null);
  }
  connectedCallback() {
    if (this._initialized) return;
    if (document.readyState === "loading") {
      this._deferredInit = () => this._init();
      document.addEventListener("DOMContentLoaded", this._deferredInit, { once: true });
      return;
    }
    this._init();
  }
  disconnectedCallback() {
    if (this._deferredInit) {
      document.removeEventListener("DOMContentLoaded", this._deferredInit);
      this._deferredInit = null;
      return;
    }
    if (!this._initialized) return;
    this._teardownHandlers();
    this._teardownSubscriptions();
    this._initialized = false;
    if (typeof this.disconnected === "function") this.disconnected(this);
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    this.update(transformDashToCamelCase(name));
    if (this._initialized && typeof this.attributeChanged === "function") {
      this.attributeChanged(name, parseAttributeValue(oldValue), parseAttributeValue(newValue));
    }
  }
  /**
   * Repaint bound nodes — all of them, or only those bound to one key.
   * The escape hatch after mutating inside an object property, which no
   * setter sees: `el.user.name = 'x'; el.update('user')`.
   */
  update(key) {
    if (!this._initialized) return;
    if (key) {
      this._applyBinds(key);
      return;
    }
    for (const k in this._binds) this._applyBinds(k);
  }
  _defineAccessor(name, attribute) {
    const key = transformDashToCamelCase(name);
    if (RESERVED.has(key)) {
      console.warn(`salis: <${this.tagName.toLowerCase()}> cannot observe "${name}" \u2014 "${key}" is reserved by salis`);
      return;
    }
    let preset;
    if (Object.prototype.hasOwnProperty.call(this, key)) {
      preset = this[key];
      delete this[key];
    }
    if (key in this) {
      console.warn(`salis: <${this.tagName.toLowerCase()}> cannot observe "${name}" \u2014 "${key}" already exists on the element`);
      return;
    }
    if (attribute) this._reflected[key] = attribute;
    else if (!(key in this._state)) this._state[key] = null;
    Object.defineProperty(this, key, attribute ? {
      get: () => parseAttributeValue(this.getAttribute(attribute)),
      set: (value) => {
        if (value === null || value === void 0 || value === false) this.removeAttribute(attribute);
        else if (value === true) this.setAttribute(attribute, "");
        else this.setAttribute(attribute, value);
      }
    } : {
      get: () => this._state[key],
      set: (value) => {
        this._unsubscribe(key);
        this._state[key] = value;
        this._assigned.add(key);
        if (this._initialized) this._subscribe(key, value);
        this.update(key);
      }
    });
    if (preset !== void 0) this[key] = preset;
  }
  // Runs through the property setters, then erases the assigned mark they
  // leave — share-applied values must stay overwritable by the next share().
  _applyShared(values) {
    for (const key in values) {
      if (!(key in this._state)) continue;
      if (this._assigned.has(key)) continue;
      this[key] = values[key];
      this._assigned.delete(key);
    }
  }
  _init() {
    this._deferredInit = null;
    if (this.constructor._shared) this._applyShared(this.constructor._shared);
    this._initialized = true;
    this.setAttribute("salis", "");
    for (const key in this._state) this._subscribe(key, this._state[key]);
    this._scanBinds();
    this._scanHandlers();
    const listener = (e) => this._act(e);
    this.addEventListener("command", listener);
    this._listeners.push({ el: this, event: "command", listener });
    this.update();
    if (typeof this.connected === "function") this.connected(this);
  }
  // The nearest salis ancestor owns a node — any salis tag, not only this
  // element's own, so different salis elements nest without stealing binds.
  _scope(el) {
    return el.closest([...salisTags].join(",")) === this;
  }
  _owns(key) {
    return key in this._reflected || key in this._state;
  }
  _scanBinds() {
    this._binds = {};
    const collect = (el) => {
      if (!this._scope(el)) return;
      const raw = el.getAttribute("bind") || el.getAttribute("data-bind");
      if (!raw) return;
      for (const entry of parseBinds(raw)) {
        const key = entry.path[0];
        if (!this._owns(key)) {
          console.warn(`salis: <${this.tagName.toLowerCase()}> has no attribute or property "${key}" for bind "${raw}"`);
          continue;
        }
        entry.el = el;
        if (!this._binds[key]) this._binds[key] = [];
        this._binds[key].push(entry);
      }
    };
    collect(this);
    this.querySelectorAll("[bind],[data-bind]").forEach(collect);
  }
  _scanHandlers() {
    this._teardownHandlers();
    const collect = (el) => {
      if (!this._scope(el)) return;
      const raw = el.getAttribute("on") || el.getAttribute("data-on");
      if (!raw) return;
      for (const part of raw.split(";")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const colon = trimmed.indexOf(":");
        if (colon === -1) {
          console.warn(`salis: unknown handler "${trimmed}" \u2014 expected event:name`);
          continue;
        }
        let event = trimmed.slice(0, colon).trim();
        const name = trimmed.slice(colon + 1).trim();
        let target = el;
        const at = event.lastIndexOf("@");
        if (at !== -1) {
          const where = event.slice(at + 1);
          target = where === "window" ? window : where === "document" ? document : null;
          if (!target) {
            console.warn(`salis: unknown handler target "${trimmed}" \u2014 expected event@window or event@document`);
            continue;
          }
          event = event.slice(0, at);
        }
        const listener = (e) => this._handle(name, e);
        target.addEventListener(event, listener);
        this._listeners.push({ el: target, event, listener });
      }
    };
    collect(this);
    this.querySelectorAll("[on],[data-on]").forEach(collect);
  }
  _teardownHandlers() {
    for (const { el, event, listener } of this._listeners) el.removeEventListener(event, listener);
    this._listeners = [];
  }
  _subscribe(key, value) {
    const subs = reactiveSubs.get(value);
    if (!subs) return;
    const fn = () => this.update(key);
    subs.add(fn);
    this._subscriptions.push({ key, subs, fn });
  }
  // Leaving a stale subscription behind on reassignment would keep the old
  // model repainting this element — and keep the element alive — forever.
  _unsubscribe(key) {
    this._subscriptions = this._subscriptions.filter((sub) => {
      if (sub.key !== key) return true;
      sub.subs.delete(sub.fn);
      return false;
    });
  }
  _teardownSubscriptions() {
    for (const { subs, fn } of this._subscriptions) subs.delete(fn);
    this._subscriptions = [];
  }
  // A method wins over the handlers registry, and only one runs — first
  // match, so a registry entry cannot double-fire behind a subclass method.
  _handle(name, e) {
    if (typeof this[name] === "function") return this[name](e, this);
    if (typeof this.handlers[name] === "function") return this.handlers[name](e, this);
    console.warn(`salis: <${this.tagName.toLowerCase()}> has no handler "${name}"`);
  }
  // Command issued, action taken. Keys are the exact command strings, dashes
  // and all — no name transformation to reason backwards through. An empty
  // registry stays silent, because commands may be handled by an `on` listener
  // instead; only a populated one makes an unknown command a typo worth naming.
  _act(e) {
    const action = this.actions[e.command];
    if (typeof action === "function") return action(e, this);
    if (Object.keys(this.actions).length) {
      console.warn(`salis: <${this.tagName.toLowerCase()}> has no action for command "${e.command}"`);
    }
  }
  _applyBinds(key) {
    const binds = this._binds[key];
    if (!binds) return;
    for (const bind of binds) {
      let value = this[key];
      if (bind.path.length > 1) value = getObjectValueByPath(value, bind.path.slice(1));
      this._render(bind, value);
    }
  }
  _render({ el, type, attr }, value) {
    if (value === void 0) return;
    switch (type) {
      case "text":
        el.textContent = value === null ? "" : value;
        break;
      case "html":
        el.innerHTML = value === null ? "" : value;
        break;
      case "value":
        el.value = value === null ? "" : value;
        break;
      case "attr":
        if (value === null || value === false) el.removeAttribute(attr);
        else el.setAttribute(attr, value === true ? "" : value);
        break;
    }
  }
};
/** Observed attributes, each becoming a reactive camelCase property reflected to the DOM. */
__publicField(SalisElement, "attributes", []);
/** Reactive properties that live only in JS, never written to an attribute. */
__publicField(SalisElement, "properties", []);
/** Named event handlers reachable from `on="event:name"`, shared by all instances. */
__publicField(SalisElement, "handlers", {});
/** Invoker Command responses, keyed by the exact `command` string (`'--add-item'`), called as (event, element). */
__publicField(SalisElement, "actions", {});
function salis(name, options = {}) {
  if (isArray(options)) options = { attributes: options };
  class Salis extends SalisElement {
  }
  __publicField(Salis, "attributes", options.attributes || []);
  __publicField(Salis, "properties", options.properties || []);
  __publicField(Salis, "handlers", options.handlers || {});
  __publicField(Salis, "actions", options.actions || {});
  for (const hook of ["connected", "disconnected", "attributeChanged"]) {
    if (typeof options[hook] === "function") Salis.prototype[hook] = options[hook];
  }
  customElements.define(name, Salis);
  return Salis;
}
export {
  SalisElement,
  salis as default,
  reactive
};
//# sourceMappingURL=salis.mjs.map
