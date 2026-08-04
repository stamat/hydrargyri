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
var RESERVED = /* @__PURE__ */ new Set(["handlers", "actions", "_state", "_binds", "_listeners", "_reflected", "_initialized", "_deferredInit"]);
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
var SalisElement = class extends HTMLElement {
  static get observedAttributes() {
    return this.attributes;
  }
  constructor() {
    super();
    salisTags.add(this.tagName.toLowerCase());
    this._state = {};
    this._binds = {};
    this._listeners = [];
    this._reflected = {};
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
        this._state[key] = value;
        this.update(key);
      }
    });
    if (preset !== void 0) this[key] = preset;
  }
  _init() {
    this._deferredInit = null;
    this._initialized = true;
    this.setAttribute("salis", "");
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
        const event = trimmed.slice(0, colon).trim();
        const name = trimmed.slice(colon + 1).trim();
        const listener = (e) => this._handle(name, e);
        el.addEventListener(event, listener);
        this._listeners.push({ el, event, listener });
      }
    };
    collect(this);
    this.querySelectorAll("[on],[data-on]").forEach(collect);
  }
  _teardownHandlers() {
    for (const { el, event, listener } of this._listeners) el.removeEventListener(event, listener);
    this._listeners = [];
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
  salis as default
};
//# sourceMappingURL=salis.mjs.map
