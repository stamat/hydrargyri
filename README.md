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
  <button on="click:decrement">−</button>
  <output bind="count">0</output>
  <button on="click:increment">+</button>
</demo-counter>
```

```js
import salis from 'salis'

salis('demo-counter', {
  attributes: ['count'],
  handlers: {
    increment(e, el) { el.count += 1 },
    decrement(e, el) { el.count -= 1 }
  }
})
```

No build step, no shadow DOM, no expression language — `bind` and `on` hold
names, never code. Salt, in the alchemical sense: the residue that stays when
the framework evaporates. It sits on
[book-of-spells](https://github.com/stamat/book-of-spells), same shelf as
[sulphuris](https://github.com/stamat/sulphuris) 🜍.

Like sulphuris, the value here is personal first: this is the wrapper I wanted
to exist, and it transfers to whoever shares the taste for markup-first pages.
If you want templating, deep reactivity, or an ecosystem, the table below says
where to go — those are fine tools and salis does not compete on their ground.

## Against the alternatives

| | Keeps your markup | Custom elements | Build step | Logic in markup | Pick it when |
|---|---|---|---|---|---|
| [Catalyst](https://github.com/github/catalyst) | yes | yes | yes — TS decorators | no | you already build with TypeScript |
| [Stimulus](https://stimulus.hotwired.dev) | yes | no — its own runtime | no | no | you want the mature ecosystem, especially around Rails |
| [Alpine](https://alpinejs.dev) | yes | no | no | yes — JS expressions in attributes | you want logic inline and accept the CSP cost |
| [Lit](https://lit.dev) | no — templates in JS | yes | no, but expected | no | you are building an app, not upgrading a page |
| salis | yes | yes | no | no | the markup exists first and must survive without the script |

Salis loses on features to every row above: no templating, no two-way binding,
no deep reactivity, no plugin ecosystem. That is the trade — the whole API
fits in the next section.

## Install

Not on npm yet — the commands below describe the shape of the release, not a
package you can pull today.

```bash
npm install salis
```

```js
import salis, { SalisElement } from 'salis'
```

Or straight from a CDN as a module, no install:

```html
<script type="module">
  import salis from 'https://cdn.jsdelivr.net/npm/salis/dist/salis.mjs'
</script>
```

## API

### `salis(name, options)` → class

Defines the custom element and returns its class. `options` as an array is
shorthand for `{ attributes: [...] }`.

| Option | Type | What it does |
|---|---|---|
| `attributes` | `Array` | Observed attributes. Each becomes a typed camelCase property reflected to the attribute — `user-name` is reachable as `el.userName`. |
| `properties` | `Array` | Reactive properties that live only in JS, never written to an attribute. |
| `handlers` | `Object` | Named functions reachable from `on="event:name"`, called as `(event, element)`. |
| `connected` | `Function` | Runs once the element is upgraded, scanned and painted, as `(element)`. |
| `disconnected` | `Function` | Runs when the element leaves the DOM, as `(element)`. |
| `attributeChanged` | `Function` | Runs on observed attribute changes as `(name, oldValue, newValue)` — parsed values, not strings. Attributes arriving from the markup are initial state, not changes; this stays silent until after `connected`. |

### `SalisElement`

The base class behind the factory, for elements that need methods of their
own. Declare the same surface as statics, define the element yourself:

```js
class UserCard extends SalisElement {
  static attributes = ['name']
  greet(e) { this.name = 'clicked' }   // reachable from on="click:greet"
}
customElements.define('user-card', UserCard)
```

Override `connected`, `disconnected` and `attributeChanged` — not the
`*Callback` methods, which run the binding machinery. A method outranks a
`handlers` entry of the same name, and only one of the two runs.

### Attribute values are typed

`count="5"` reads back as `5`, `active` with no value as `true`, an absent
attribute as `null`. Setting `false` or `null` removes the attribute, `true`
sets it valueless. The attribute is the only copy of the state — devtools
edits and salis writes cannot disagree.

### `bind`

`bind="path[:type[#attr]]"`, several entries separated by `;`. The path may
reach into objects: `bind="user.name"`.

| Type | Writes | Cleared by `null` |
|---|---|---|
| `text` (default) | `textContent` | empty string |
| `html` | `innerHTML` — see the warning below | empty string |
| `value` | `.value`, for form fields | empty string |
| `attr#name` | the named attribute via `setAttribute` | attribute removed; `false` removes too, `true` sets valueless |

A typo in a path or an unknown type warns in the console and skips that entry
— the element's other binds keep painting.

### `on`

`on="event:name"`, several separated by `;` — `on="focus:note;input:note"`.
The name resolves to a method on the element first, then to `handlers`. An
unknown name warns on first fire instead of throwing.

### `update(key)` / `update()`

Repaints nodes bound to one key, or all of them. This is the escape hatch for
the reactivity salis deliberately does not have: mutation *inside* an object
property hits no setter, so `el.user.name = 'x'` paints nothing until
`el.update('user')`.

### `[salis]`

The element wears a `salis` attribute once initialized. `x-el:not([salis])`
styles the not-yet-upgraded state — or hides nothing, since the markup
underneath is the fallback by design.

## What salis does not do

- **Deep reactivity.** Setters notice assignment, not mutation. `update(key)`
  exists because a Proxy that watches everything is the kind of magic this
  library is built to avoid.
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
script/server   # build + serve the demo with live reload, http://localhost:4040
script/build    # compile dist/ and the demo site
script/test     # jest
```

## License

[MIT](LICENSE) © [Nikola Stamatovic](https://github.com/stamat)
