import { isArray, isObject, shallowMerge, stringToPrimitive } from "book-of-spells";

//TODO: Try to extend a custom class with SalisElement
/**
 * Salis
 * 
 * @todo dash-case attributes vs camelCase, check how it's resolved
 * @todo multiple event handlers separated by semicolon
 * 
 * Do this in a declarative way, each binding type should be a function and then call it by name
 * bind="
 *  variable.property:text;
 *  variable2.property2:html, 
 *  variable3.property3:value, 
 *  variable4.property4:attribute#href
 *"
 * on="
 * click:handlerName;
 * mouseover:handlerName2
 * "
 */

/**
 * getObjectValueByPath
 * 
 * @param {Object} obj
 * @param {Array|String} path
 * @returns {Any}
 * 
 * @example
 * const obj = {
 *  prop1: {
 *    prop2: {
 *      prop3: 'foo'
 *    }
 *  }
 * }
 * 
 * getObjectValueByPath(obj, 'prop1.prop2.prop3') // 'foo'
 */
function getObjectValueByPath(obj, path) {
  if (typeof path === 'string') path = path.split('.');
  return path.reduce((acc, part) => acc[part], obj);
}

export default function salis(name, options) {
  this.name = name;
  this.options = {};
  const self = this;

  if (isArray(options)) this.options.attributes = options;
  else if (typeof options === "object") shallowMerge(this.options, options);
  
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
      this._properties = {}; // programmatic properties, not reflected on the attributes but can be used to store data and bind it to the DOM
      this.handlers = {}; // event handlers
      this._binds = {};
      this.setAttribute('salis', '');

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
      this.querySelectorAll('[bind],[data-bind]').forEach(this._initializeSingleBind.bind(this));
      this._initializeSingleBind(this);
    }

    _initializeSingleBind(el) {
      if (el.closest(this.tagName) !== this) return;
      const bind = el.getAttribute('bind') || el.getAttribute('data-bind');
      if (!bind) return;
      
      if (this._binds.hasOwnProperty(bind)) {
        if (isArray(this._binds[bind])) this._binds[bind].push(el);
        else this._binds[bind] = [this._binds[bind], el];
      } else {
        this._binds[bind] = el;
      }
    }

    //TODO: this
    parseBindString(value) {
      const parts = value.split(';');
      const binds = {};
      for (let part of parts) {
        const entry = this.parseBindEntry(part);
        if (binds.hasOwnProperty(entry.path[0])) {
          if (isArray(binds[entry.path[0]])) binds[entry.path[0]].push(entry);
          else binds[entry.path[0]] = [binds[entry.path[0]], entry];
        } else {
          binds[entry.path[0]] = entry;
        }
      }
    }

    //TODO: and this
    parseBindEntry(entry) {
      const parts = value.split(':');
      const path = parts[0];
      let type = parts[1];
      const typeParts = type.split('#');
      type = typeParts[0];
      const attribute = typeParts[1];
      const callback = parts[2];
      return { path, type, attribute, callback };
    }

    _initializeHandlers() {
      this.querySelectorAll('[on],[data-on]').forEach(this._initializeSingleHandler.bind(this));
      this._initializeSingleHandler(this);
    }

    _initializeSingleHandler(el) {
      if (el.closest(this.tagName) !== this) return;
      const value = el.getAttribute('on') || el.getAttribute('data-on');
      if (!value) return;
      const parts = value.split(':');
      
      el.addEventListener(parts[0], (e) => {
        this._executeHandler(parts[1], e);
      });
    }

    subscribeAttribute(attr) {
      if (!this._attributes.hasOwnProperty(attr)) this._attributes[attr] = null;
      Object.defineProperty(this, attr, {
        get: () => {
          return this._attributes[attr];
        },
        set: (value) => {
          this.setAttribute(attr, value);
          this._attributes[attr] = value;
          this.update(attr);
        }
      });
    }

    subscribeProperty(prop) {
      if (!this._properties.hasOwnProperty(prop)) this._properties[prop] = null;
      Object.defineProperty(this, prop, {
        get: () => {
          return this._properties[prop];
        },
        set: (value) => {
          this._properties[prop] = value;
          this.update(prop);
        }
      });
    }

    _executeHandler(name, e) {
      if (this.hasOwnProperty(name) && typeof this[name] === 'function') this[name](e, this);
      if (this.handlers.hasOwnProperty(name)) this.handlers[name](e, this);
    }

    //TODO: there should be a way to tell how to update the binding, if it's textContent, innerHTML, value, etc.
    // There should be a way to also add callbacks to the binding, so when it's updated, it calls a function.
    // You should be able to set multiple bindings separated by semicolon.
    // Something like attr2:textContent:callbackName;attr3:innerHTML:callbackName2

    //Also what about properties of the object values? like obj.prop1, obj.prop2, etc.
    _updateBinding(bind) {
      if (!this._binds.hasOwnProperty(bind)) return;
      let value = this._attributes.hasOwnProperty(bind) ? this._attributes[bind] : this._properties[bind];
      if (value === undefined && window && window.hasOwnProperty(bind)) value = window[bind]; //maybe this should have an option toggle
      if (value === undefined) return;

      if (isArray(this._binds[bind])) this._binds[bind].forEach((el) => {
        el.textContent = value;
      });
      else this._binds[bind].textContent = value;
    }

    update(bind) {
      if (bind) {
        this._updateBinding(bind);
      } else
      for (let bind in this._binds) {
        this._updateBinding(bind);
      }
    }
    
    //TODO: what about single attribute change handler?
    attributeChangedCallback(name, oldValue, newValue) {
      newValue = stringToPrimitive(newValue);
      this._attributes[name] = newValue;
      this.update(name);

      console.log(`Attribute ${name} changed from ${oldValue} to ${newValue}`);
      if (this._options.attributeChangedCallback) {
        oldValue = stringToPrimitive(oldValue);
        this._options.attributeChangedCallback(name, oldValue, newValue);
      }
    }
  }
  this.class = SalisElement;
  
  customElements.define(name, SalisElement);
}

salis('salis-element', {
  attributes: ['test', 'attr2', 'aria-foo']
});

//console.log(salis)

window.whatever = 'foo'

const elem = document.querySelector('salis-element[test="baz"]');
//console.log(elem)

elem.attr2 = 54
elem['aria-foo'] = 'bar'
//console.log(elem.foo)
elem.handlers.yell = (e, el) => {
  console.log('yell', e, el)
}

elem.update()

console.log(elem.binds)

const elem3 = document.querySelector('salis-element[test="bar"]');
elem3.attr2 = 78
elem3.subscribeProperty('foo')
elem3.foo = 'bar'

elem3.yell = (e, el) => {
  console.log('AAAAAAAAAAAAAAAAA!!!!!!');
  elem3.foo = 'baz';
  console.log(this);
}

const elem2 = document.querySelector('salis-element[test="foo"]');
elem2.attr2 = 23
console.log(elem2.handlers)
