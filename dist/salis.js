/* salis v1.0.0 | https://stamat.github.io/salis/ | MIT License */
(() => {
  // src/scripts/salis.js
  var Salis = class {
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
        attributeChangedCallback(name2, oldValue, newValue) {
          console.log(`Attribute ${name2} changed from ${oldValue} to ${newValue}`);
          this._attributes[name2] = newValue;
        }
      }
      this.class = SalisElement;
      this.name = name;
      customElements.define(name, SalisElement);
    }
  };
  var salis = new Salis("salis-element", ["test", "attr2"]);
  console.log(salis);
  document.querySelector("salis-element").attr2 = 54;
  console.log(document.querySelector("salis-element"));
})();
//# sourceMappingURL=salis.js.map
