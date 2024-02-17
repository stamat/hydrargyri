/* salis v1.0.0 | https://stamat.github.io/salis/ | MIT License */
(() => {
  // node_modules/book-of-spells/src/helpers.mjs
  function shallowMerge(target, source) {
    for (const key in source) {
      target[key] = source[key];
    }
    return target;
  }
  function stringToBoolean(str) {
    if (/^\s*(true|false)\s*$/i.test(str))
      return str === "true";
  }
  function stringToNumber(str) {
    if (/^\s*\d+\s*$/.test(str))
      return parseInt(str);
    if (/^\s*[\d.]+\s*$/.test(str))
      return parseFloat(str);
  }
  function stringToPrimitive(str) {
    if (/^\s*null\s*$/.test(str))
      return null;
    const bool = stringToBoolean(str);
    if (bool !== void 0)
      return bool;
    return stringToNumber(str) || str;
  }
  function isArray(o) {
    return Array.isArray(o);
  }

  // src/scripts/salis.js
  function salis(name, options) {
    this.name = name;
    this.options = {};
    const self = this;
    if (isArray(options))
      this.options.attributes = options;
    else if (typeof options === "object")
      shallowMerge(this.options, options);
    class SalisElement extends HTMLElement {
      static get observedAttributes() {
        return self.options.attributes;
      }
      get binds() {
        return this._binds;
      }
      get attributes() {
        return this._attributes;
      }
      get properties() {
        return this._properties;
      }
      constructor() {
        super();
        this._attributes = {};
        this._options = self.options;
        this._properties = {};
        this.handlers = {};
        this._binds = {};
        this.setAttribute("salis", "");
        for (let attr of this._options.attributes) {
          this.subscribeAttribute(attr);
        }
        for (let prop in this._options.properties) {
          this.subscribeProperty(prop);
        }
        this.handlers = this._options.handlers || {};
        this._initializeBinds();
        this._initializeHandlers();
      }
      _initializeBinds() {
        this.querySelectorAll("[bind],[data-bind]").forEach(this._initializeSingleBind.bind(this));
        this._initializeSingleBind(this);
      }
      _initializeSingleBind(el) {
        if (el.closest(this.tagName) !== this)
          return;
        const bind = el.getAttribute("bind") || el.getAttribute("data-bind");
        if (!bind)
          return;
        if (this._binds.hasOwnProperty(bind)) {
          if (isArray(this._binds[bind]))
            this._binds[bind].push(el);
          else
            this._binds[bind] = [this._binds[bind], el];
        } else {
          this._binds[bind] = el;
        }
      }
      //TODO: this
      parseBindString(value2) {
        const parts = value2.split(";");
        const binds = {};
        for (let part of parts) {
          const entry = this.parseBindEntry(part);
          if (binds.hasOwnProperty(entry.path[0])) {
            if (isArray(binds[entry.path[0]]))
              binds[entry.path[0]].push(entry);
            else
              binds[entry.path[0]] = [binds[entry.path[0]], entry];
          } else {
            binds[entry.path[0]] = entry;
          }
        }
      }
      //TODO: and this
      parseBindEntry(entry) {
        const parts = value.split(":");
        const path = parts[0];
        let type = parts[1];
        const typeParts = type.split("#");
        type = typeParts[0];
        const attribute = typeParts[1];
        const callback = parts[2];
        return { path, type, attribute, callback };
      }
      _initializeHandlers() {
        this.querySelectorAll("[on],[data-on]").forEach(this._initializeSingleHandler.bind(this));
        this._initializeSingleHandler(this);
      }
      _initializeSingleHandler(el) {
        if (el.closest(this.tagName) !== this)
          return;
        const value2 = el.getAttribute("on") || el.getAttribute("data-on");
        if (!value2)
          return;
        const parts = value2.split(":");
        el.addEventListener(parts[0], (e) => {
          this._executeHandler(parts[1], e);
        });
      }
      subscribeAttribute(attr) {
        if (!this._attributes.hasOwnProperty(attr))
          this._attributes[attr] = null;
        Object.defineProperty(this, attr, {
          get: () => {
            return this._attributes[attr];
          },
          set: (value2) => {
            this.setAttribute(attr, value2);
            this._attributes[attr] = value2;
            this.update(attr);
          }
        });
      }
      subscribeProperty(prop) {
        if (!this._properties.hasOwnProperty(prop))
          this._properties[prop] = null;
        Object.defineProperty(this, prop, {
          get: () => {
            return this._properties[prop];
          },
          set: (value2) => {
            this._properties[prop] = value2;
            this.update(prop);
          }
        });
      }
      _executeHandler(name2, e) {
        if (this.hasOwnProperty(name2) && typeof this[name2] === "function")
          this[name2](e, this);
        if (this.handlers.hasOwnProperty(name2))
          this.handlers[name2](e, this);
      }
      //TODO: there should be a way to tell how to update the binding, if it's textContent, innerHTML, value, etc.
      // There should be a way to also add callbacks to the binding, so when it's updated, it calls a function.
      // You should be able to set multiple bindings separated by semicolon.
      // Something like attr2:textContent:callbackName;attr3:innerHTML:callbackName2
      //Also what about properties of the object values? like obj.prop1, obj.prop2, etc.
      _updateBinding(bind) {
        if (!this._binds.hasOwnProperty(bind))
          return;
        let value2 = this._attributes.hasOwnProperty(bind) ? this._attributes[bind] : this._properties[bind];
        if (value2 === void 0 && window && window.hasOwnProperty(bind))
          value2 = window[bind];
        if (value2 === void 0)
          return;
        if (isArray(this._binds[bind]))
          this._binds[bind].forEach((el) => {
            el.textContent = value2;
          });
        else
          this._binds[bind].textContent = value2;
      }
      update(bind) {
        if (bind) {
          this._updateBinding(bind);
        } else
          for (let bind2 in this._binds) {
            this._updateBinding(bind2);
          }
      }
      //TODO: what about single attribute change handler?
      attributeChangedCallback(name2, oldValue, newValue) {
        newValue = stringToPrimitive(newValue);
        this._attributes[name2] = newValue;
        this.update(name2);
        console.log(`Attribute ${name2} changed from ${oldValue} to ${newValue}`);
        if (this._options.attributeChangedCallback) {
          oldValue = stringToPrimitive(oldValue);
          this._options.attributeChangedCallback(name2, oldValue, newValue);
        }
      }
    }
    this.class = SalisElement;
    customElements.define(name, SalisElement);
  }
  salis("salis-element", {
    attributes: ["test", "attr2", "aria-foo"]
  });
  window.whatever = "foo";
  var elem = document.querySelector('salis-element[test="baz"]');
  elem.attr2 = 54;
  elem["aria-foo"] = "bar";
  elem.handlers.yell = (e, el) => {
    console.log("yell", e, el);
  };
  elem.update();
  console.log(elem.binds);
  var elem3 = document.querySelector('salis-element[test="bar"]');
  elem3.attr2 = 78;
  elem3.subscribeProperty("foo");
  elem3.foo = "bar";
  elem3.yell = (e, el) => {
    console.log("AAAAAAAAAAAAAAAAA!!!!!!");
    elem3.foo = "baz";
    console.log(void 0);
  };
  var elem2 = document.querySelector('salis-element[test="foo"]');
  elem2.attr2 = 23;
  console.log(elem2.handlers);
})();
//# sourceMappingURL=salis.js.map
