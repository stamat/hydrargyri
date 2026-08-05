# <sup>🜔</sup> Salis

> Reactive web components in the light DOM — declarative binds and handlers on markup you already wrote.

Every reactive framework starts the same way: move your markup into our world.
Templates in JS, decorators that need a build step, expressions interpreted out
of attributes. The page you already had — the one that renders without any of
it — becomes the framework's output instead of your document.

Salis goes the other way. You keep the HTML. A custom element wraps the part
that changes, `bind` says where state lands, `on` says what fires, and the
script never loading leaves the page exactly as written:

```html
<demo-counter count="0">
  <button on="click:decrement" aria-label="Decrement">−</button>
  <output bind="count">0</output>
  <button on="click:increment" aria-label="Increment">+</button>
</demo-counter>
```

```js
import salis from "salis";

salis("demo-counter", {
  attributes: ["count"],
  handlers: {
    increment(e, el) {
      el.count += 1;
    },
    decrement(e, el) {
      el.count -= 1;
    },
  },
});
```

No build step, no shadow DOM, no expression language — `bind` and `on` hold
names, never code. Salt, in the alchemical sense: the residue that stays when
the framework evaporates. It sits on
[book-of-spells](https://github.com/stamat/book-of-spells), same shelf as
[sulphuris](https://github.com/stamat/sulphuris) 🜍.

Like sulphuris, the value here is personal first: this is the wrapper I wanted
to exist, and it transfers to whoever shares the taste for markup-first pages.
If you want templating, two-way binding, or an ecosystem, the table below says
where to go — those are fine tools and salis does not compete on their ground.

## Against the alternatives

|                                                | Keeps your markup    | Custom elements      | Build step          | Logic in markup                    | Pick it when                                                |
| ---------------------------------------------- | -------------------- | -------------------- | ------------------- | ---------------------------------- | ----------------------------------------------------------- |
| [Catalyst](https://github.com/github/catalyst) | yes                  | yes                  | yes — TS decorators | no                                 | you already build with TypeScript                           |
| [Stimulus](https://stimulus.hotwired.dev)      | yes                  | no — its own runtime | no                  | no                                 | you want the mature ecosystem, especially around Rails      |
| [Alpine](https://alpinejs.dev)                 | yes                  | no                   | no                  | yes — JS expressions in attributes | you want logic inline and accept the CSP cost               |
| [Lit](https://lit.dev)                         | no — templates in JS | yes                  | no, but expected    | no                                 | you are building an app, not upgrading a page               |
| salis                                          | yes                  | yes                  | no                  | no                                 | the markup exists first and must survive without the script |

Salis loses on features to every row above: no templating, no two-way binding,
no plugin ecosystem. That is the trade — the whole API fits in the next
section.

Stimulus earns the honest footnote: same religion, different church. The same
names-in-markup creed, the same CSP-cleanliness, near-identical event wiring
and typed attribute-backed values. The doctrine splits on exactly two points —
`bind` paints declaratively where Stimulus targets are refs you repaint by
hand, and the component boundary is the platform's custom element instead of a
runtime with a registry, which is also why salis is 2 kB where Stimulus is 12.
If neither point matters to your project, go to their church; it is better run
in every other respect.

## Docs

<https://stamat.github.io/salis/> — the same reference as below, with every
sample running live and editable on the page, plus
[`llms.txt`](https://stamat.github.io/salis/llms.txt) for the agents.

## Install

Not on npm yet — the commands below describe the shape of the release, not a
package you can pull today.

```bash
npm install salis
```

```js
import salis, { SalisElement, reactive } from "salis";
```

Or straight from a CDN as a module, no install:

```html
<script type="module">
  import salis from "https://cdn.jsdelivr.net/npm/salis/dist/salis.mjs";
</script>
```

## API

### `salis(name, options)` → class

Defines the custom element and returns its class. `options` as an array is
shorthand for `{ attributes: [...] }`.

| Option             | Type       | What it does                                                                                                                                                                                                          |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attributes`       | `Array`    | Observed attributes. Each becomes a typed camelCase property reflected to the attribute — `user-name` is reachable as `el.userName`.                                                                                  |
| `properties`       | `Array`    | Reactive properties that live only in JS, never written to an attribute.                                                                                                                                              |
| `handlers`         | `Object`   | Named functions reachable from `on="event:name"`, called as `(event, element)`.                                                                                                                                       |
| `actions`          | `Object`   | Invoker Command responses, keyed by the exact `command` string (`'--add-item'`), called as `(event, element)`. Unknown commands warn only when actions are declared. Assignable at runtime: `el.actions['--x'] = fn`. |
| `connected`        | `Function` | Runs once the element is upgraded, scanned and painted, as `(element)`.                                                                                                                                               |
| `disconnected`     | `Function` | Runs when the element leaves the DOM, as `(element)`.                                                                                                                                                                 |
| `attributeChanged` | `Function` | Runs on observed attribute changes as `(name, oldValue, newValue)` — parsed values, not strings. Attributes arriving from the markup are initial state, not changes; this stays silent until after `connected`.       |

### `SalisElement`

The base class behind the factory, for elements that need methods of their
own. Declare the same surface as statics, define the element yourself:

```js
class UserCard extends SalisElement {
  static attributes = ["name"];
  greet(e) {
    this.name = "clicked";
  } // reachable from on="click:greet"
}
customElements.define("user-card", UserCard);
```

Override `connected`, `disconnected` and `attributeChanged` — not the
`*Callback` methods, which run the binding machinery. A method outranks a
`handlers` entry of the same name, and only one of the two runs.

### Attribute values are typed

`count="5"` reads back as `5`, `active` with no value as `true`, an absent
attribute as `null`. Setting `false` or `null` removes the attribute, `true`
sets it valueless. The attribute is the only copy of the state — devtools
edits and salis writes cannot disagree.

Coercion is by value, not intent: `zip="01102"` reads back as the number
`1102`. A value that must stay a string keeps a non-numeric character, or
reads through `getAttribute` where salis never touches it.

A name that already answers on the element is refused at definition, with a
warning naming it, and the element keeps working without it — `update` and the
rest of the salis API, natives like `title` or `hidden`, and any method your
subclass declares. Failing there beats a `TypeError` three calls from the cause.

### `bind`

`bind="path[:type[#attr]]"`, several entries separated by `;`. The path may
reach into objects: `bind="user.name"`.

| Type             | Writes                                 | Cleared by `null`                                             |
| ---------------- | -------------------------------------- | ------------------------------------------------------------- |
| `text` (default) | `textContent`                          | empty string                                                  |
| `html`           | `innerHTML` — see the warning below    | empty string                                                  |
| `value`          | `.value`, for form fields              | empty string                                                  |
| `attr#name`      | the named attribute via `setAttribute` | attribute removed; `false` removes too, `true` sets valueless |

A typo in a path or an unknown type warns in the console and skips that entry
— the element's other binds keep painting.

`data-bind` and `data-on` work identically to `bind` and `on` — for markup
that must satisfy a validator, since the bare names are non-standard
attributes. Where both sit on one element, the bare form wins.

### `on`

`on="event:name"`, several separated by `;` — `on="focus:note;input:note"`.
The name resolves to a method on the element first, then to `handlers`. An
unknown name warns on first fire instead of throwing.

`event@window` and `event@document` put the listener on the global instead —
for `resize`, Escape, click-outside — with the handler still the element's and
the listener still unhooked on disconnect, so the usual leak writes itself
out of the pattern.

### `update(key)` / `update()`

Repaints nodes bound to one key, or all of them. This is the escape hatch for
the reactivity salis does not do implicitly: mutation _inside_ an object
property hits no setter, so `el.user.name = 'x'` paints nothing until
`el.update('user')` — or until the model is `reactive()`.

### `reactive(model)`

The opt-in way out of `update(key)`: wrap a model once, assign it to any
number of elements, and mutation through the proxy repaints them all — no
element references at the mutation site.

```js
import salis, { reactive } from "salis";

const user = reactive({ name: "Aja", role: "site design manager" });

const Card = salis("user-card", { properties: ["user"] });
Card.share({ user });

user.role = "director of design"; // every card repaints — current and future alike
```

The proxy is the model: mutating the raw original notifies nobody. Only plain
objects and arrays wrap — a Map or a class instance warns and comes back
unwrapped, since their methods reach for internal slots a proxy does not have.
Repaints are per key, with no dependency tracking; disconnecting an element
unsubscribes it, reconnecting catches it up.

### `share(values)`

A static on every salis class — the tag-wide form of `el.user = user`, called
once, never per change. Present instances get each value on the spot, future
ones as they connect; shared with a `reactive()` model it is a standing
broadcast. An instance assignment outranks `share` on that instance, forever
— reconnects included — so `share` fills elements the app said nothing about
and never overwrites one it did. Property keys only: an attribute-backed key
warns and is refused, since the attribute is the markup's per-instance state.
No registry behind it — the class reference is the capability, and
`querySelectorAll` at call time is the instance list.

### `[salis]`

The element wears a `salis` attribute once initialized. `x-el:not([salis])`
styles the not-yet-upgraded state — or hides nothing, since the markup
underneath is the fallback by design.

## Elements talking to each other

Events up, attributes down — the platform's own protocol, and salis already
speaks both halves. There is no bus, no store, no `$dispatch`: `on` listens to
any event name, custom events included, and they bubble.

```html
<x-cart on="item-picked:refresh">
  <x-item sku="7"><button on="click:pick">add</button></x-item>
</x-cart>
```

```js
salis("x-item", {
  attributes: ["sku"],
  handlers: {
    pick(e, el) {
      el.dispatchEvent(
        new CustomEvent("item-picked", {
          bubbles: true,
          detail: { sku: el.sku },
        }),
      );
    },
  },
});

salis("x-cart", {
  properties: ["count"],
  handlers: {
    refresh(e, el) {
      el.count = (el.count || 0) + 1;
    },
  },
});
```

The one footgun is the platform's: forget `bubbles: true` and the event
reaches nobody, silently. The other direction is plainer still — a parent
writes a child's observed attribute, and the child repaints and reacts on its
own: `el.querySelector('x-item').sku = 9`. Siblings compose the two through
their common ancestor. State shared wider than that belongs to the page, not
to salis.

For a trigger with no common ancestor at all, the platform now has
[`commandfor`/`command`](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API)
— a button targets any element by id, the browser fires a `command` event on
the target, and `actions` answers it:

```html
<button commandfor="cart" command="--add-item">Add</button>
<!-- …anywhere else in the document… -->
<x-cart id="cart">…</x-cart>
```

```js
salis("x-cart", {
  attributes: ["count"],
  actions: {
    "--add-item": (e, el) => {
      el.count += 1;
    },
  },
});
```

`actions` is the command counterpart of `handlers`: command issued, action
taken. Keys are the exact `command` strings, dashes and all — no name
transformation to reason backwards through. An unknown command warns; an
element with no actions declared stays silent, since `on="command:name"` can
handle commands its own way instead.

Baseline newly available (December 2025): older browsers leave the button
inert — nothing breaks, nothing happens. A page that must work everywhere
keeps the bubbling-event route above, or loads
[invokers-polyfill](https://github.com/keithamus/invokers-polyfill) itself —
salis does not bundle it, since an element only listens and a page using no
commands should not pay for one. Big salute to [@keithamus](https://github.com/keithamus),the legend!

## What salis does not do

- **Implicit deep reactivity.** Setters notice assignment, not mutation —
  `update(key)` repaints after mutating a plain object. `reactive(model)` is
  the one exception, and it only opens by name: salis never wraps an object
  you did not ask wrapped, and will not grow dependency tracking, computed
  values or effects.
- **Two-way binding.** DOM to state goes through a handler you wrote —
  `on="input:rename"` — never behind your back.
- **Late DOM.** Binds and handlers are scanned when the element connects. A
  `bind` node inserted afterwards is not seen; re-connecting the element
  rescans everything.
- **Sanitizing.** `:html` is `innerHTML`, verbatim. Bind your own state to it,
  never user input — `text` and `attr` binds are inert by construction, so
  markup arriving through them stays text. There is a test proving it.
- **Waiting politely half-done.** During parse, an element defers its scan to
  `DOMContentLoaded` so it never binds against half its children. Load the
  script `defer` or as a module and this costs nothing.

## Development

```bash
script/bootstrap # npm ci, from a fresh clone
script/server    # build + serve the docs with live reload, http://localhost:4040
script/build     # compile dist/ and the docs site into _site/
script/test      # jest
script/lint      # eslint
```

[CONTRIBUTING.md](CONTRIBUTING.md) says what belongs here and what a pull
request needs; [AGENTS.md](AGENTS.md) is the same for a coding agent.

## License

[MIT](LICENSE) © [Stamat](https://github.com/stamat)
