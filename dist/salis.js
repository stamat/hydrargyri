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
  function isObject(o) {
    return typeof o === "object" && !Array.isArray(o) && o !== null;
  }
  function isArray(o) {
    return Array.isArray(o);
  }

  // src/scripts/salis.js
  var Salis = class {
    constructor(name, options) {
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
        constructor() {
          super();
          this._attributes = {};
          this._options = self.options;
          this._properties = {};
          this.handlers = {};
          this._binds = {};
          this.setAttribute("salis", "");
          for (let attr of this._options.attributes) {
            Object.defineProperty(this, attr, {
              get: () => {
                return stringToPrimitive(this.getAttribute(attr));
              },
              set: (value) => {
                if (isArray(value) || isObject(value))
                  value = JSON.stringify(value);
                else
                  value = value.toString();
                this.setAttribute(attr, value);
              }
            });
          }
          for (let prop in this._options.properties) {
            Object.defineProperty(this, prop, {
              get: () => {
                return this._properties[prop];
              },
              set: (value) => {
                this._properties[prop] = value;
                if (this.binds.hasOwnProperty(prop)) {
                  if (isArray(this.binds[prop]))
                    this.binds[prop].forEach((el) => {
                      el.textContent = value;
                    });
                  else
                    this.binds[prop].textContent = value;
                }
              }
            });
          }
          for (let handler in this._options.handlers) {
            this.handlers[handler] = this._options.handlers[handler];
          }
          this.querySelectorAll("[bind],[data-bind]").forEach((el) => {
            if (el.closest(self.name).parentNode.closest(self.name))
              return;
            const bind = el.getAttribute("bind") || el.getAttribute("data-bind");
            if (this._binds.hasOwnProperty(bind)) {
              if (isArray(this._binds[bind]))
                this._binds[bind].push(el);
              else
                this._binds[bind] = [this._binds[bind], el];
            } else {
              this._binds[bind] = el;
            }
          });
          this.querySelectorAll("[on],[data-on]").forEach((el) => {
            if (el.closest(self.name).parentNode.closest(self.name))
              return;
            const value = el.getAttribute("on") || el.getAttribute("data-on");
            const parts = value.split(":");
            this.addEventListener(parts[0], (e) => {
              this.executeHandler(parts[1], e);
            });
          });
        }
        executeHandler(name2, e) {
          if (this.handlers.hasOwnProperty(name2))
            this.handlers[name2](e, this);
        }
        attributeChangedCallback(name2, oldValue, newValue) {
          oldValue = stringToPrimitive(oldValue);
          newValue = stringToPrimitive(newValue);
          this._attributes[name2] = newValue;
          if (this.binds.hasOwnProperty(name2))
            this._binds[name2].textContent = newValue;
          console.log(`Attribute ${name2} changed from ${oldValue} to ${newValue}`);
          if (this._options.attributeChangedCallback)
            this._options.attributeChangedCallback(name2, oldValue, newValue);
        }
      }
      this.class = SalisElement;
      customElements.define(name, SalisElement);
    }
  };
  var salis = new Salis("salis-element", {
    attributes: ["test", "attr2", "aria-foo"],
    handlers: {
      yell: (e, el) => {
        console.log("yell", e, el);
      }
    }
  });
  console.log(salis);
  var elem = document.querySelector('salis-element[test="baz"]');
  console.log(elem);
  elem.attr2 = 54;
  elem["aria-foo"] = "bar";
  console.log(elem.foo);
  elem.handlers.yell = (e, el) => {
    console.log("yell", e, el);
  };
  var elem2 = document.querySelector('salis-element[test="foo"]');
  elem2.attr2 = 23;
})();
//# sourceMappingURL=salis.js.map
