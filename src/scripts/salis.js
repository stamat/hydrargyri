export default class Salis {
  constructor(name, attributesToObserve) {
    class SalisElement extends HTMLElement {
      static get observedAttributes() {
        return attributesToObserve;
      }

      constructor() {
        super();
        this._attributes = {};
        for (let attr of attributesToObserve) {
          Object.defineProperty(this, attr, {
            get: () => this.getAttribute(attr),
            set: (value) => this.setAttribute(attr, value)
          });
        }
      }
      
      attributeChangedCallback(name, oldValue, newValue) {
        console.log(`Attribute ${name} changed from ${oldValue} to ${newValue}`);
        this._attributes[name] = newValue;
      }
    }

    this.class = SalisElement;
    this.name = name;

    customElements.define(name, SalisElement);
  }
}

const salis = new Salis('salis-element', ['test', 'attr2']);

console.log(salis)

document.querySelector('salis-element').attr2 = 54
console.log(document.querySelector('salis-element'))
