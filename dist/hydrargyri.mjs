/* hydrargyri v2.2.0 | https://stamat.github.io/hydrargyri/ | MIT License */
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

// src/scripts/hydrargyri.js
var hgTags = /* @__PURE__ */ new Set();
var hgSelector = "";
var BIND_TYPES = /* @__PURE__ */ new Set(["text", "html", "value", "attr", "prop", "class", "if", "unless"]);
var NAMED_BIND_TYPES = /* @__PURE__ */ new Set(["attr", "prop", "class"]);
var RESERVED = /* @__PURE__ */ new Set(["handlers", "conditions", "formatters", "_state", "_binds", "_listeners", "_reflected", "_attrTypes", "_jsonCache", "_subscriptions", "_assigned", "_initialized", "_deferredInit"]);
var reactiveSubs = /* @__PURE__ */ new WeakMap();
var proxyRaw = /* @__PURE__ */ new WeakMap();
var reactiveModels = /* @__PURE__ */ new WeakMap();
function propertyNames(properties) {
  return isArray(properties) ? properties : Object.keys(properties);
}
function camelKeys(obj) {
  const out = {};
  for (const key in obj) out[transformDashToCamelCase(key)] = obj[key];
  return out;
}
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
function parseAttributeEntry(entry) {
  const colon = entry.indexOf(":");
  if (colon === -1) return { name: entry.trim(), type: null };
  return { name: entry.slice(0, colon).trim(), type: entry.slice(colon + 1).trim() };
}
function pairKey({ event, where, name }) {
  return `${event}@${where || ""}:${name}`;
}
function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}
function parseBinds(raw) {
  const entries = [];
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const pipes = trimmed.split("|");
    if (pipes.length > 2) {
      console.warn(`hydrargyri: unknown bind "${trimmed}" \u2014 one |formatter per entry, chaining is not supported`);
      continue;
    }
    let format = null;
    if (pipes.length === 2) {
      const segments = pipes[1].split(":").map((s) => s.trim());
      if (segments.some((s) => !s)) {
        console.warn(`hydrargyri: unknown bind "${trimmed}" \u2014 expected |formatter[:arg[:arg]]`);
        continue;
      }
      format = { name: segments[0], args: segments.slice(1).map((arg) => arg.split(".")) };
    }
    const bindPart = pipes[0].trim();
    const colon = bindPart.indexOf(":");
    const pathPart = colon === -1 ? bindPart : bindPart.slice(0, colon);
    const typePart = colon === -1 ? "" : bindPart.slice(colon + 1);
    const path = pathPart.trim().split(".");
    let type = "text";
    let attr = null;
    if (typePart) {
      const hash = typePart.indexOf("#");
      type = (hash === -1 ? typePart : typePart.slice(0, hash)).trim();
      attr = hash === -1 ? null : typePart.slice(hash + 1).trim();
    }
    if (!BIND_TYPES.has(type) || NAMED_BIND_TYPES.has(type) && !attr) {
      console.warn(`hydrargyri: unknown bind "${trimmed}" \u2014 expected path[:text|html|value|attr#name|prop#name|class#name|if#condition|unless#condition]`);
      continue;
    }
    if (format && (type === "if" || type === "unless")) {
      console.warn(`hydrargyri: bind "${trimmed}" \u2014 a formatter cannot shape an ${type} bind, that is a condition's job; formatter ignored`);
      format = null;
    }
    entries.push({ path, type, attr, format });
  }
  return entries;
}
function reactive(obj) {
  if (reactiveSubs.has(obj)) return obj;
  if (reactiveModels.has(obj)) return reactiveModels.get(obj);
  if (!isPlainValue(obj)) {
    console.warn("hydrargyri: reactive() takes a plain object or array \u2014 returned the value as given");
    return obj;
  }
  const subs = /* @__PURE__ */ new Set();
  let pending = false;
  const notify = () => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      for (const fn of subs) fn();
    });
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
        var _a, _b;
        const prev = target[prop];
        const ok = Reflect.set(target, prop, value, receiver);
        if (ok && !Object.is((_a = proxyRaw.get(prev)) != null ? _a : prev, (_b = proxyRaw.get(value)) != null ? _b : value)) notify();
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
    proxyRaw.set(proxy, raw);
    wrapped.set(raw, proxy);
    return proxy;
  };
  const model = wrap(obj);
  reactiveModels.set(obj, model);
  return model;
}
var _HgElement = class _HgElement extends HTMLElement {
  static get observedAttributes() {
    return this.attributes.map((entry) => parseAttributeEntry(entry).name);
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
    const owned = new Set(propertyNames(this.properties).map(transformDashToCamelCase));
    const accepted = {};
    for (const key in values) {
      const name = transformDashToCamelCase(key);
      if (owned.has(name)) accepted[name] = values[key];
      else console.warn(`hydrargyri: share() takes declared properties \u2014 "${key}" ignored`);
    }
    this._shared = Object.assign({}, this._shared, accepted);
    if (!this._tag) return;
    document.querySelectorAll(this._tag).forEach((el) => {
      if (typeof el._applyShared === "function") el._applyShared(accepted);
    });
  }
  // Everything shared with this class: object-form property defaults under a
  // later share() of the same key — a runtime call overrides the declaration.
  static _sharedAll() {
    const declared = isArray(this.properties) ? null : camelKeys(this.properties);
    if (!declared && !this._shared) return null;
    return Object.assign({}, declared, this._shared);
  }
  constructor() {
    super();
    const tag = this.tagName.toLowerCase();
    if (!hgTags.has(tag)) {
      hgTags.add(tag);
      hgSelector = [...hgTags].join(",");
    }
    this.constructor._tag = tag;
    this._state = {};
    this._binds = {};
    this._listeners = [];
    this._reflected = {};
    this._attrTypes = {};
    this._jsonCache = {};
    this._subscriptions = [];
    this._assigned = /* @__PURE__ */ new Set();
    this._initialized = false;
    this._deferredInit = null;
    this.handlers = Object.assign({}, this.constructor.handlers);
    this.conditions = Object.assign({}, this.constructor.conditions);
    this.formatters = Object.assign({}, this.constructor.formatters);
    for (const entry of this.constructor.attributes) {
      const { name, type } = parseAttributeEntry(entry);
      this._defineAccessor(name, name, type);
    }
    for (const prop of propertyNames(this.constructor.properties)) this._defineAccessor(prop, null, null);
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
      this.attributeChanged(name, this._parseAttribute(name, oldValue), this._parseAttribute(name, newValue));
    }
  }
  // A string-typed attribute is a verbatim channel: the exact attribute text,
  // `''` included — only absent still reads null. A json-typed one hands out
  // the frozen parse. Everything else takes the HTML-boolean-and-primitive
  // reading of parseAttributeValue.
  _parseAttribute(attribute, raw) {
    const type = this._attrTypes[attribute];
    if (type === "string") return raw;
    if (type === "json") return this._parseJson(attribute, raw);
    return parseAttributeValue(raw);
  }
  // One parse per attribute value, cached by the raw string — every read of an
  // unchanged attribute returns the same frozen object, so identity survives
  // between paints. Malformed JSON (a valueless attribute included) warns and
  // reads null, and the cache is what keeps that warning to once per value
  // rather than once per read.
  _parseJson(attribute, raw) {
    if (raw === null) return null;
    const cached = this._jsonCache[attribute];
    if (cached && cached.raw === raw) return cached.value;
    let value = null;
    try {
      value = deepFreeze(JSON.parse(raw));
    } catch {
      console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> attribute "${attribute}" holds malformed JSON \u2014 read as null`);
    }
    this._jsonCache[attribute] = { raw, value };
    return value;
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
  _defineAccessor(name, attribute, type) {
    const key = transformDashToCamelCase(name);
    if (type !== null && type !== "string" && type !== "json") {
      console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> attribute "${name}:${type}" \u2014 string and json are the only types; reading as auto`);
      type = null;
    }
    if (attribute && type) this._attrTypes[attribute] = type;
    if (RESERVED.has(key)) {
      console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> cannot observe "${name}" \u2014 "${key}" is reserved by hydrargyri`);
      return;
    }
    let preset;
    if (Object.prototype.hasOwnProperty.call(this, key)) {
      preset = this[key];
      delete this[key];
    }
    if (key in this) {
      console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> cannot observe "${name}" \u2014 "${key}" already exists on the element`);
      return;
    }
    if (attribute) this._reflected[key] = attribute;
    else if (!(key in this._state)) this._state[key] = null;
    Object.defineProperty(this, key, attribute ? {
      get: () => this._parseAttribute(attribute, this.getAttribute(attribute)),
      set: (value) => {
        if (value === null || value === void 0) this.removeAttribute(attribute);
        else if (type === "json") this.setAttribute(attribute, JSON.stringify(value));
        else if (value === false) this.removeAttribute(attribute);
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
    const shared = this.constructor._sharedAll();
    if (shared) this._applyShared(shared);
    this._initialized = true;
    this.setAttribute("hg", "");
    for (const key in this._state) this._subscribe(key, this._state[key]);
    this._scanBinds();
    this._scanHandlers();
    this._wireCommands();
    this.update();
    if (typeof this.connected === "function") this.connected(this);
  }
  /**
   * Re-collect binds and handlers from the current subtree and repaint — the
   * door for markup that changed under an initialized element, e.g. a handler
   * swapping innerHTML. Detached nodes drop their binds and listeners, new
   * ones wire and paint. A no-op before init: connect is the first scan.
   */
  rescan() {
    if (!this._initialized) return;
    this._scanBinds();
    this._scanHandlers();
    this._wireCommands();
    this.update();
  }
  // Always wired, even with no command keys declared: a handler assigned at
  // runtime then routes without the author re-wiring anything. Registered
  // in _listeners after the handler scan tears the old set down, so both
  // teardown and rescan unhook it with the rest.
  _wireCommands() {
    const listener = (e) => this._act(e);
    this.addEventListener("command", listener);
    this._listeners.push({ el: this, event: "command", listener });
  }
  // The nearest hydrargyri ancestor owns a node — any hydrargyri tag, not only this
  // element's own, so different hydrargyri elements nest without stealing binds.
  // The selector grows with every tag ever defined and closest() pays for it
  // per scanned node — the ceiling is scan cost on pages defining many tags;
  // a per-scan ancestor cache is the upgrade if it ever shows up in a profile.
  _scope(el) {
    return el.closest(hgSelector) === this;
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
        const keys = /* @__PURE__ */ new Set([entry.path[0]]);
        if (entry.format) for (const arg of entry.format.args) keys.add(arg[0]);
        const unknown = [...keys].find((key) => !this._owns(key));
        if (unknown !== void 0) {
          console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> has no attribute or property "${unknown}" for bind "${raw}"`);
          continue;
        }
        if (el === this && entry.type === "prop" && entry.attr && this._owns(transformDashToCamelCase(entry.attr))) {
          console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> bind "${raw}" writes its own reactive "${entry.attr}" \u2014 a feedback loop; assign the property from a handler instead`);
          continue;
        }
        entry.el = el;
        for (const key of keys) {
          if (!this._binds[key]) this._binds[key] = [];
          this._binds[key].push(entry);
        }
      }
    };
    collect(this);
    this.querySelectorAll("[bind],[data-bind]").forEach(collect);
  }
  _scanHandlers() {
    this._teardownHandlers();
    const wired = /* @__PURE__ */ new Map();
    const collect = (el) => {
      if (!this._scope(el)) return;
      const keys = this._wireHandlers(el);
      if (keys.length) wired.set(el, new Set(keys));
    };
    collect(this);
    this.querySelectorAll("[on],[data-on]").forEach(collect);
    this._scanWires(wired);
  }
  // The pair grammar — `event[@window|@document]:name`, `;`-separated — parsed
  // in one place for the `on` attribute and `static wires` both, so the two
  // cannot fork. A malformed pair warns and is skipped; its neighbours still wire.
  _parseHandlers(raw) {
    const entries = [];
    for (const part of raw.split(";")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const colon = trimmed.indexOf(":");
      if (colon === -1) {
        console.warn(`hydrargyri: unknown handler "${trimmed}" \u2014 expected event:name`);
        continue;
      }
      let event = trimmed.slice(0, colon).trim();
      const name = trimmed.slice(colon + 1).trim();
      let where = null;
      const at = event.lastIndexOf("@");
      if (at !== -1) {
        where = event.slice(at + 1);
        if (where !== "window" && where !== "document") {
          console.warn(`hydrargyri: unknown handler target "${trimmed}" \u2014 expected event@window or event@document`);
          continue;
        }
        event = event.slice(0, at);
      }
      entries.push({ event, where, name });
    }
    return entries;
  }
  // resize@window / click@document put the listener on the global while the
  // handler stays this element's; stored in _listeners like any other, so
  // disconnect unhooks it and nothing can leak.
  _wireEntry(el, { event, where, name }) {
    const target = where === "window" ? window : where === "document" ? document : el;
    const listener = (e) => this._handle(name, e);
    target.addEventListener(event, listener);
    this._listeners.push({ el: target, event, listener });
  }
  // One node's `on`/`data-on` parsed and wired — the unit _scanHandlers sweeps
  // with, callable alone for nodes that arrive after the scan (hydrargyri-each
  // wires fresh rows with it, without rescanning the standing ones). Scope is
  // the caller's to check; calling twice on one node doubles its listeners.
  // Returns the wired pair keys, which is what lets wires skip them.
  _wireHandlers(el) {
    const raw = el.getAttribute("on") || el.getAttribute("data-on");
    if (!raw) return [];
    const keys = [];
    for (const entry of this._parseHandlers(raw)) {
      this._wireEntry(el, entry);
      keys.push(pairKey(entry));
    }
    return keys;
  }
  // Class-declared listeners on the nodes a selector names — the plumbing a
  // subclass needs in every instance, wired without the author writing it.
  // The markup wins where they meet: a pair the node already wired from its
  // own `on` attribute is skipped, so markup predating the wires keeps firing
  // once. A selector that will not parse warns and is skipped; the other
  // selectors still wire.
  _scanWires(wired) {
    for (const [selector, spec] of Object.entries(this.constructor.wires)) {
      let nodes;
      try {
        nodes = [...this.querySelectorAll(selector)];
        if (this.matches(selector)) nodes.unshift(this);
      } catch {
        console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> wires selector "${selector}" will not parse \u2014 skipped`);
        continue;
      }
      const entries = this._parseHandlers(spec);
      for (const el of nodes) {
        if (!this._scope(el)) continue;
        let keys = wired.get(el);
        for (const entry of entries) {
          const key = pairKey(entry);
          if (keys && keys.has(key)) continue;
          this._wireEntry(el, entry);
          if (!keys) wired.set(el, keys = /* @__PURE__ */ new Set());
          keys.add(key);
        }
      }
    }
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
  // A subclass method wins over the handlers registry, and only one runs —
  // first match, so a registry entry cannot double-fire behind it. Authored
  // methods only, found below HgElement in the chain: without that floor,
  // `on="click:remove"` reaches Element.prototype.remove and the click
  // silently detaches the element itself.
  _handle(name, e) {
    if (this._authoredMethod(name)) return this[name](e, this);
    if (typeof this.handlers[name] === "function") return this.handlers[name](e, this);
    if (typeof this[name] === "function") {
      console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> handler "${name}" only matches the platform's ${name}() \u2014 not called; declare it in handlers`);
      return;
    }
    console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> has no handler "${name}"`);
  }
  // Walks from the instance down to HgElement.prototype, exclusive — what is
  // found on the way was written by an author; what sits at or past the base
  // class is hydrargyri's API or the platform's, and neither is a handler.
  _authoredMethod(name) {
    if (typeof this[name] !== "function") return false;
    let proto = this;
    while (proto && proto !== _HgElement.prototype) {
      if (Object.prototype.hasOwnProperty.call(proto, name)) return true;
      proto = Object.getPrototypeOf(proto);
    }
    return false;
  }
  // Commands look up handlers by the exact command string, dashes and all —
  // no name transformation to reason backwards through, and custom commands
  // must start with `--`, so command keys cannot collide with handler names.
  // Registry only, no method lookup: a subclass method must not become
  // command-invokable by its name alone. Unknown commands warn only when some
  // `--` key is declared, because commands may be handled by an `on` listener
  // instead; only a declared command key makes an unknown one a typo worth naming.
  _act(e) {
    const action = this.handlers[e.command];
    if (typeof action === "function") return action(e, this);
    if (Object.keys(this.handlers).some((key) => key.startsWith("--"))) {
      console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> has no handler for command "${e.command}"`);
    }
  }
  _applyBinds(key) {
    const binds = this._binds[key];
    if (!binds) return;
    for (const bind of binds) {
      this._render(bind, this._resolve(bind.path));
    }
  }
  _resolve(path) {
    const value = this[path[0]];
    return path.length > 1 ? getObjectValueByPath(value, path.slice(1)) : value;
  }
  // Stateless on purpose: no memory of the last painted value, so an unchanged
  // value is written again, and a bind registered under two keys (its own and a
  // formatter argument's) paints once per key in a full update(). Nothing can go
  // stale across a rescan; a per-entry last-value memo is the upgrade if
  // repaint cost ever earns it.
  _render({ el, type, attr, format }, value) {
    if (value === void 0) return;
    if (format) {
      const formatter = this.formatters[format.name];
      if (typeof formatter !== "function") {
        console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> has no formatter "${format.name}"`);
      } else {
        value = formatter(value, this, ...format.args.map((arg) => this._resolve(arg)));
        if (value === void 0) return;
      }
    }
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
      // No coercion and no absent state: an attribute can only hold a string,
      // which is why an array or an object reaching another element has to come
      // this way. `null` writes null, because a property has no "removed".
      case "prop":
        el[attr] = value;
        break;
      // One class token, toggled on truthiness — never the whole attribute, so
      // the author's classes and any other script's survive, and there is no
      // record of the last paint to go stale across a rescan.
      case "class":
        el.classList.toggle(attr, !!value);
        break;
      case "if":
      case "unless": {
        let truth = value;
        if (attr) {
          const condition = this.conditions[attr];
          if (typeof condition !== "function") {
            console.warn(`hydrargyri: <${this.tagName.toLowerCase()}> has no condition "${attr}"`);
            break;
          }
          truth = condition(value, this);
        }
        el.toggleAttribute("hidden", type === "unless" ? !!truth : !truth);
        break;
      }
    }
  }
};
/** Observed attributes, each becoming a reactive camelCase property reflected to the DOM. An entry may carry a type — `'zip:string'` reads verbatim, `'config:json'` parses to a frozen object. */
__publicField(_HgElement, "attributes", []);
/** Reactive properties that live only in JS, never written to an attribute — an array of names, or an object of name → class-wide default (define-time share). */
__publicField(_HgElement, "properties", []);
/** Named event handlers reachable from `on="event:name"`, shared by all instances. A key that is an exact `command` string (`'--add-item'`) also answers that Invoker Command, called as (event, element). */
__publicField(_HgElement, "handlers", {});
/** Named predicates for `bind="key:if#name"` and `key:unless#name`, called as (value, element) at paint — truthy shows the node under `if`, hides it under `unless`. */
__publicField(_HgElement, "conditions", {});
/** Named formatters for `bind="key|name[:arg…]"`, called as (value, element, ...args) at paint — the return value is what lands in the node. Args are property paths resolved on the element, never literals. */
__publicField(_HgElement, "formatters", {});
/** Listeners the class wires itself, by selector — `{ 'audio, video': 'play:onPlay;pause:onPause' }`, the same pair grammar `on` takes. Wired at scan on every matching node in scope, the element itself included; a pair the node's own `on` attribute already carries is skipped. */
__publicField(_HgElement, "wires", {});
var HgElement = _HgElement;
function hg(name, options = {}) {
  if (isArray(options)) options = { attributes: options };
  class Hg extends HgElement {
  }
  __publicField(Hg, "attributes", options.attributes || []);
  __publicField(Hg, "properties", options.properties || []);
  __publicField(Hg, "handlers", options.handlers || {});
  __publicField(Hg, "conditions", options.conditions || {});
  __publicField(Hg, "formatters", options.formatters || {});
  __publicField(Hg, "wires", options.wires || {});
  for (const hook of ["connected", "disconnected", "attributeChanged"]) {
    if (typeof options[hook] === "function") Hg.prototype[hook] = options[hook];
  }
  customElements.define(name, Hg);
  return Hg;
}
export {
  HgElement,
  hg as default,
  hg as hydrargyri,
  parseBinds,
  reactive
};
//# sourceMappingURL=hydrargyri.mjs.map
