Salis is a small JavaScript library (`salis`) for reactive custom elements in
the **light DOM** — no shadow roots, no build step, no expression language. It
upgrades markup an author already wrote rather than generating markup of its
own, so a page renders without it and keeps rendering if the script never
loads.

Two attributes carry the whole declarative surface, and both hold **names, never
code**: `bind="path[:type[#attr]]"` says where state lands, `on="event:name"`
says what fires. Nothing in either is evaluated, so there is nothing to
sanitize and nothing for a Content Security Policy to object to.

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
    increment(e, el) { el.count += 1 },
    decrement(e, el) { el.count -= 1 }
  }
});
```

The API:

- `salis(name, options)` defines a custom element and returns its class.
  `options` takes `attributes`, `properties`, `handlers`, `conditions`, and
  the `connected` / `disconnected` / `attributeChanged` hooks; an array is
  shorthand for `attributes`.
- `SalisElement` is the exported base class, for elements that need methods of
  their own. A method outranks a `handlers` entry of the same name.
- Observed attributes become typed camelCase properties reflected to the DOM —
  `count="5"` reads back as `5`, a valueless attribute as `true`, an absent one
  as `null`. Assigning `null` or `false` removes the attribute. The attribute is
  the only copy of the state.
- `properties` are reactive but never written to an attribute — objects,
  arrays, timer handles. As an object, `properties: { user: model }` maps
  name → class-wide default: the define-time form of `share()`.
- `bind` types: `text` (default, `textContent`), `html` (`innerHTML`), `value`
  (`.value`), `attr#name` (`setAttribute`), `if` / `if#condition` (toggles
  `hidden` — bare follows truthiness, `#name` runs the named predicate from
  `conditions`, called as `(value, element)` on every paint of the key, truthy
  shows), `unless` / `unless#condition` (the same toggle inverted — `if` and
  `unless` on sibling nodes are a full if/else with no JS). Entries separate
  with `;`; a path may reach into an object (`user.name`).
- `update(key)` repaints one key, `update()` all of them. It is the escape
  hatch for mutation inside a plain object, which no setter sees. Reassignment
  needs no call: `el.user = { ...el.user, name: 'x' }` fires the setter.
- `reactive(model)` wraps a plain object or array in a deep proxy; assign it
  to any number of elements and mutation through the proxy repaints them all.
  The proxy is the model — the raw original notifies nobody — and non-plain
  values (Maps, class instances) warn and come back unwrapped.
- `share(values)` is a static on every salis class: `Cls.share({ user: model })`
  hands each value to every instance, present and future — called once, never
  per change. An instance assignment outranks share on that instance, forever.
  Property keys only; attribute-backed keys warn and are refused.
- `on` may target the globals: `on="resize@window:name"` and
  `on="click@document:name"` register the listener on `window` or `document` —
  the handler stays the element's, and disconnect unhooks it with the rest.
- `data-bind` and `data-on` are accepted where a validator objects to the bare
  names.
- The element wears a `salis` attribute once initialized, so
  `x-el:not([salis])` can style the not-yet-upgraded state.

Deliberate non-goals: implicit deep reactivity (assignment is watched, mutation
needs `update(key)` or an opt-in `reactive()` model — salis never wraps an
object you did not ask wrapped),
two-way binding (DOM to state goes through a handler you wrote), late DOM (binds
are scanned on connect; reconnecting rescans), sanitizing (`:html` is
`innerHTML` verbatim — bind your own state to it, never user input), templating,
virtual DOM, routing and stores.

Elements compose through the platform: bubbling custom events upward, writing a
child's observed attribute downward, and `commandfor`/`command` where there is
no common ancestor — the browser fires a `command` event on the target and a
handler keyed by the exact command string answers it
(`handlers: { '--add-item': (e, el) => {} }`). There is no bus.

A name that already answers on the element — `update`, a native like `title`, a
subclass method — is refused at definition with a warning, and the element keeps
working without it.

Same shelf as [book-of-spells](https://github.com/stamat/book-of-spells) (the
plain JavaScript helpers it is built on) and
[sulphuris](https://github.com/stamat/sulphuris) (the CSS).
