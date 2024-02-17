import { isArray, isObject, shallowMerge, stringToPrimitive } from "book-of-spells";

//TODO: Does this have to be a class? It can be a function...
/**
 * Salis
 * 
 * @todo dash-case attributes vs camelCase, check how it's resolved
 * @todo test the support for custom properties and bind them to the DOM
 * @todo multiple event handlers separated by semicolon
 */
export default class Salis {
  constructor(name, options) {
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

      constructor() {
        super();
        this._attributes = {};
        this._options = self.options;
        this._properties = {}; // programmatic properties, not reflected on the attributes but can be used to store data and bind it to the DOM
        this.handlers = {}; // event handlers
        this._binds = {};
        this.setAttribute('salis', '');

        for (let attr of this._options.attributes) {
          Object.defineProperty(this, attr, {
            get: () => {
              return stringToPrimitive(this.getAttribute(attr))
            },
            set: (value) => {
              if (isArray(value) || isObject(value)) value = JSON.stringify(value);
              else value = value.toString();
              this.setAttribute(attr, value)
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
                if (isArray(this.binds[prop])) this.binds[prop].forEach((el) => {
                  el.textContent = value;
                });
                else this.binds[prop].textContent = value;
              }
            }
          });
        }

        for (let handler in this._options.handlers) {
          this.handlers[handler] = this._options.handlers[handler];
        }

        this.querySelectorAll('[bind],[data-bind]').forEach((el) => {
          if (el.closest(this.tagName) !== this) return;
          const bind = el.getAttribute('bind') || el.getAttribute('data-bind');
          if (this._binds.hasOwnProperty(bind)) {
            if (isArray(this._binds[bind])) this._binds[bind].push(el);
            else this._binds[bind] = [this._binds[bind], el];
          } else {
            this._binds[bind] = el;
          }
        });

        this.querySelectorAll('[on],[data-on]').forEach((el) => {
          if (el.closest(this.tagName) !== this) return;
          const value = el.getAttribute('on') || el.getAttribute('data-on');
          const parts = value.split(':');
          
          el.addEventListener(parts[0], (e) => {
            this._executeHandler(parts[1], e);
          });
        });
      }

      _executeHandler(name, e) {
        if (this.handlers.hasOwnProperty(name)) this.handlers[name](e, this);
      }
      
      attributeChangedCallback(name, oldValue, newValue) {
        oldValue = stringToPrimitive(oldValue);
        newValue = stringToPrimitive(newValue);
        this._attributes[name] = newValue;

        if (this.binds.hasOwnProperty(name)) {
          if (isArray(this.binds[name])) this.binds[name].forEach((el) => {
            el.textContent = newValue;
          });
          else
          this._binds[name].textContent = newValue;
        }

        // console.log(`Attribute ${name} changed from ${oldValue} to ${newValue}`);
        if (this._options.attributeChangedCallback) this._options.attributeChangedCallback(name, oldValue, newValue);
      }
    }
    this.class = SalisElement;

    customElements.define(name, SalisElement);
  }
}

const salis = new Salis('salis-element', {
  attributes: ['test', 'attr2', 'aria-foo']
});

//console.log(salis)

const elem = document.querySelector('salis-element[test="baz"]');
//console.log(elem)

elem.attr2 = 54
elem['aria-foo'] = 'bar'
//console.log(elem.foo)
elem.handlers.yell = (e, el) => {
  console.log('yell', e, el)
}

const elem3 = document.querySelector('salis-element[test="bar"]');
elem3.attr2 = 78

elem3.handlers.yell = (e, el) => {
  console.log('AAAAAAAAAAAAAAAAA!!!!!!');
}

const elem2 = document.querySelector('salis-element[test="foo"]');
elem2.attr2 = 23
console.log(elem2.handlers)
