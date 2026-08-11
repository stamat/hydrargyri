---
layout: poops-docs-theme/docs
title: API
description: hg(), HgElement, typed attributes, reactive properties, the lifecycle hooks, update() and reactive().
order: 1
---

# API

Two entry points, and the second exists only because the first cannot carry
methods.

## `hg(name, options)` → class

Defines the custom element and returns its class. `options` as an array is
shorthand for `{ attributes: [...] }`, which is the shape most elements need.

It is the default export, so the import names it whatever you like — the docs
use `hg`. A named export `hydrargyri` is the same function, for the times the
full name reads better:

```js
import hg from "hydrargyri";
import { hydrargyri } from "hydrargyri";
```

| Option             | Type       | What it does                                                                                                                                                                                                    |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attributes`       | `Array`    | Observed attributes. Each becomes a typed camelCase property reflected to the attribute — `user-name` is reachable as `el.userName`. An entry may carry a type: `"zip:string"` reads verbatim, `"config:json"` parses to a [frozen object](#attribute-values-are-typed). |
| `properties`       | `Array`, `Object` | Reactive properties that live only in JS, never written to an attribute. An object maps name → class-wide starting value — the define-time [`share()`](#sharevalues): `properties: { user: model, draft: null }`. |
| `handlers`         | `Object`   | Named functions reachable from `on="event:name"`, called as `(event, element)` — `event@window` / `event@document` for [global events](on.html#window-and-document). A key that is an exact [Invoker Command](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API) string (`'--add-item'`) also answers that command. An unknown command warns only when a `--` key is declared — otherwise the element stays silent, since `on="command:name"` may be handling commands instead. Assignable at runtime: `el.handlers['--x'] = fn`. |
| `conditions`       | `Object`   | Named predicates for [`if` and `unless` binds](bind.html#conditions) (`bind="items:if#isEmpty"`), called as `(value, element)` on every paint of the key — the initial `null` included. Truthy shows the node under `if`, hides it under `unless`. A missing condition warns and leaves the node as authored. Assignable at runtime: `el.conditions.isEmpty = fn`. |
| `formatters`       | `Object`   | Named functions for [formatted binds](bind.html#formatters) (`bind="price\|money:currency"`), called as `(value, element, ...args)` on every paint of the key — the return value is what lands in the node. Args are property paths resolved on the element, never literals, and the bind repaints when they change. A missing formatter warns and paints the raw value. Assignable at runtime: `el.formatters.money = fn`. |
| `connected`        | `Function` | Runs once the element is upgraded, scanned and painted, as `(element)`.                                                                                                                                         |
| `disconnected`     | `Function` | Runs when the element leaves the DOM, as `(element)`.                                                                                                                                                           |
| `attributeChanged` | `Function` | Runs on observed attribute changes as `(name, oldValue, newValue)` — parsed values, not strings. Attributes arriving from the markup are initial state, not changes; this stays silent until after `connected`. |

## Attribute values are typed

`count="5"` reads back as `5`, `active` with no value as `true`, an absent
attribute as `null`. Setting `false` or `null` removes the attribute, `true`
sets it valueless. The attribute is the only copy of the state — devtools edits
and hydrargyri writes cannot disagree, because there is nothing to disagree with.

| In the markup      | `el.thing` reads | Assigning        | The attribute becomes |
| ------------------ | ---------------- | ---------------- | --------------------- |
| `thing="5"`        | `5`              | `el.thing = 5`   | `thing="5"`           |
| `thing="hi"`       | `"hi"`           | `el.thing = "hi"`| `thing="hi"`          |
| `thing`            | `true`           | `el.thing = true`| `thing=""`            |
| absent             | `null`           | `el.thing = null`| removed               |
|                    |                  | `el.thing = false`| removed              |

Coercion is by value, not intent: `zip="01102"` would read back as the number
`1102`, the leading zero gone. An attribute declared with the `string` type —
same `name:type` grammar as `bind` — is a verbatim channel instead:

```js
hg("order-card", { attributes: ["zip:string", "count"] });
```

`el.zip` now reads exactly what the attribute holds, `""` included; only an
absent attribute still reads `null`, and assignment keeps the removal rules
above.

`json` is the other named type — for the server-rendered payload an element
should read without a line of script:

```html
<order-card config='{"currency":"eur","tiers":[10,50]}'>…</order-card>
```

```js
hg("order-card", { attributes: ["config:json"] });
```

`el.config` is the parsed object — parsed once per attribute value, the same
object identity on every read until the attribute changes. The parse is frozen
deep: the attribute is the only copy of the state, so mutating the parse would
diverge the two silently — frozen, `el.config.currency = "usd"` throws where
it was written. Change the state by assigning — `el.config = { ...el.config,
currency: "usd" }` — which stringifies back into the attribute, booleans
staying JSON values rather than the valueless convention. Malformed JSON — a
valueless `config` included — warns once per value and reads `null`.

`string` and `json` are the only named types: auto already covers numbers and
booleans, and a typo in a type warns and reads as auto rather than costing the
attribute.

## `properties`

State that is nobody else's business. A property is reactive the same way an
attribute is — assignment repaints every node bound to it — but nothing is
written to the DOM, so it holds objects, arrays, functions, a `setInterval`
handle, anything an attribute cannot spell.

The clock is the case: a ticking string has no business in the markup, and
starting and stopping the timer is what the lifecycle hooks are for.

<!-- demo -->

```html
<demo-clock>
  <time bind="time">…</time>
</demo-clock>
```

```js demo
hg("demo-clock", {
  properties: ["time"],
  connected(el) {
    el.time = new Date().toLocaleTimeString();
    el._timer = setInterval(() => { el.time = new Date().toLocaleTimeString() }, 1000);
  },
  disconnected(el) {
    clearInterval(el._timer);
  }
});
```

`disconnected` is not optional bookkeeping here: an element removed from the
page with its interval still running is a leak that keeps a reference to the
element alive. Hydrargyri unhooks the listeners it added; the ones you started are
yours to stop.

## Lifecycle

Three hooks, and the order is the part worth knowing.

| Hook               | When                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `connected`        | after the element is upgraded, its binds and handlers scanned, and every bound node painted once |
| `attributeChanged` | on an observed attribute changing **after** that first paint          |
| `disconnected`     | when the element leaves the DOM, after its listeners are unhooked     |

Attributes arriving from the markup are initial state, not changes, so
`attributeChanged` stays silent through the upgrade — `connected` is where the
element meets them. Without that rule every element would have to tell the
difference between "the author wrote `count="0"`" and "something set count to
0" on its own, every time.

During parse the scan is deferred to `DOMContentLoaded`, so an element never
binds against half its children. Load the script `defer` or as a module and
this costs nothing.

## `update(key)` / `update()`

Repaints nodes bound to one key, or all of them. This is the escape hatch for
the reactivity hydrargyri deliberately does not have: mutation _inside_ an object
property hits no setter, so `el.user.name = 'x'` paints nothing until you say
so.

<!-- demo -->

```html
<demo-profile>
  <p><strong bind="user.name">—</strong> — <span bind="user.role">—</span></p>
  <button on="click:promote">Promote</button>
</demo-profile>
```

```js demo
hg("demo-profile", {
  properties: ["user"],
  connected(el) {
    el.user = { name: "Aja", role: "site design manager" };
  },
  handlers: {
    promote(e, el) {
      el.user.role = "director of design";
      el.update("user"); // without this line, nothing moves
    }
  }
});
```

Delete the `update` call and the button does nothing visible while the data
underneath it changes — which is the honest failure mode of a library that
watches assignment and not mutation. A Proxy that watched everything would fix
it — [`reactive()`](#reactivemodel) is that proxy, opt-in and by name, for the
models that earn it.

Or skip the call by not mutating: hand the key a fresh value —
`el.user = { ...el.user, role: "director of design" }` — and the setter is the
repaint. One statement, and no copy at all when the value is built new. The
escape hatch is for the mutation you cannot avoid; reassignment is the
streamlined path when you can.

## `rescan()`

Re-collects binds and handlers from the element's current subtree and
repaints — the door for markup that changed under an initialized element.
[Scanning happens once, at connect](bind.html#what-is-scanned-and-when): a
handler that swaps `innerHTML` leaves the new nodes unseen and the old,
detached ones still held and painted into. `rescan()` is that same scan by
request — detached nodes drop their binds and listeners, new ones wire and
paint:

```js
handlers: {
  swap(e, el) {
    el.innerHTML = '<span bind="count"></span>';
    el.rescan(); // the new span paints, the old subtree is let go
  }
}
```

Removing the element and putting it back runs the same scan through the
lifecycle; `rescan()` is that door without the round trip. Before the element
initializes it is a no-op — connect is the first scan. What stays refused is
the automatic version, a `MutationObserver` watching the subtree — see
[Limits](limits.html#late-dom).

## `reactive(model)`

`update(key)` scales with one element and one mutation site. The moment one
model feeds several elements — the same user on a card, in a header, behind a
menu — every mutation site needs a reference to every element showing it.
`reactive` inverts that: wrap the model once, assign it wherever, and mutation
through the proxy repaints every element holding it.

<!-- demo -->

```html
<demo-crew>
  <p><strong bind="user.name">—</strong> — <span bind="user.role">—</span></p>
  <button on="click:promote">Promote</button>
</demo-crew>
<demo-crew>
  <p>Also watching: <span bind="user.role">—</span></p>
</demo-crew>
```

```js demo
const user = reactive({ name: "Aja", role: "site design manager" });

hg("demo-crew", {
  // The handshake, tag-wide: { user } declares the key and hands the model
  // to every crew card, existing and future alike.
  properties: { user },
  handlers: {
    promote() {
      user.role = "director of design"; // no update(), no element in sight — both cards repaint
    }
  }
});
```

The model must still meet its elements once — a mutation names no tags, so
nothing can wire itself. The object form of `properties` is that handshake at
define time, [`share()`](#sharevalues) is the same at runtime, and per-instance
assignment (`el.user = user`) is for the other case, where the app decides which
element holds which model.

`share` composes with data that is not there yet. A reactive model separates
two events a promise usually glues together — *shared* and *filled*: create
the model empty, so its identity exists before its contents, share it, and
let one fetch fill it through the proxy.

<!-- demo -->

```html
<demo-lazy>
  <p><strong bind="user.name">Loading…</strong> <span bind="user.role"></span></p>
  <button on="click:reload">Reload</button>
</demo-lazy>
<demo-lazy>
  <p>Same model, second card: <strong bind="user.name">…</strong></p>
</demo-lazy>
```

```js demo
const crew = [
  { name: "Aja", role: "director of design" },
  { name: "Ada", role: "engineer" },
  { name: "Grace", role: "rear admiral" }
];
let turn = 0;
const fetchUser = () => // stands in for fetch(url).then((r) => r.json())
  new Promise((resolve) => setTimeout(() => resolve(crew[turn++ % crew.length]), 1200));

const user = reactive({});                              // identity exists now
fetchUser().then((data) => Object.assign(user, data));  // one fetch, module scope

hg("demo-lazy", {
  properties: { user },
  handlers: {
    async reload() {
      Object.assign(user, await fetchUser()); // no element references — the model is the hub
    }
  }
});
```

Nothing here awaits anywhere near an element, and no spinner machinery
exists: the placeholder between the tags is the loading state, already
written, and a path through a missing branch paints nothing until
`Object.assign` lands through the proxy — then every card repaints, shared
before the data or added after. Press **Reload** and the old name holds while
the new one is in flight — stale-while-refetching for free. The refetch
writes into the *same* model: identity outlives contents, so new data never
means a new handshake. A fetch that can fail is yours to `catch` — hydrargyri
ignores what hooks and handlers return.

The rules, and each is load-bearing:

- **The proxy is the model.** `reactive` returns a deep proxy; mutating the
  raw original notifies nobody. Create the model reactive and pass the proxy
  around — never keep the raw. Wrapping the same object again returns that
  same model, never a second one, so two call sites cannot end up with split
  subscribers.
- **Only plain objects and arrays wrap.** A Map, a Date, a class instance
  warns and comes back unwrapped — their methods reach for internal slots a
  proxy does not have.
- **Repaints are per key, not per path.** Any mutation inside the model
  repaints everything bound to its key on each subscribed element. There is no
  dependency tracking; at hydrargyri scale a repaint is a few `textContent` writes.
- **Mutations coalesce.** A synchronous burst of mutations repaints once, at
  the end of the microtask — a `splice` is one repaint with the final array,
  never one per shifted element, and no intermediate state is ever painted.
  Assignment and `update()` stay synchronous; code that must read the DOM
  after a mutation awaits a microtask first (`await null` is enough).
- **Models do not merge.** A reactive model assigned inside another keeps its
  own subscribers — mutation notifies the model it was mutated through.
- **Assignment subscribes, disconnect unsubscribes.** An element removed from
  the DOM stops repainting; reconnecting catches it up. Async data, reactive
  models and element lifecycle compose without coordination code.

## `share(values)`

A static on every hydrargyri class: `Crew.share({ user: model })` hands each value
to every instance of the element — the tag-wide form of `el.user = model`,
called once, never per change. Present instances get it on the spot; future
ones pick it up as they connect. Share a `reactive()` model and the pair is a
standing broadcast: mutate the model anywhere, every instance repaints, no
element references at the mutation site and no re-`share` ever.

The object form of `properties` is this same call at define time —
`properties: { user: model }` declares the key and shares the value in one
place, no class variable, no second line. `share()` is the runtime half:
swapping a model later, releasing one — and a runtime call overrides the
declared default from then on.

The precedence rule keeps it safe to mix with assignment: **an instance
assignment outranks share on that instance, forever** — including across
disconnects and reconnects, and across later `share` calls. `share` fills
elements the app has said nothing about; it never overwrites one it has.

Property keys only. An attribute-backed key warns and is refused: the
attribute is the markup's state, per instance by design, and a tag-wide write
would put one value in every instance's markup while claiming each instance
still owns its own. A key the element does not declare warns and is skipped,
and the entry's neighbours still land.

There is no registry behind this — the class reference is the whole
capability, and `document.querySelectorAll` is the instance list, consulted at
the moment of the call. An element class nobody calls `share` on pays
nothing.

Releasing is the same call: `Crew.share({ user: null })` replaces the stored
reference — instances that got the model from `share` get the `null` with the
same sweep, and ones connecting later start with it. Only instances the app
assigned directly keep theirs, by the precedence rule above. Share what the
page has one of — the current user, the cart, the viewport; a noun that
pluralizes per instance is assignment's, and the app's loop knows which is
whose.

## `HgElement`

The base class behind the factory, for elements that need methods of their own.
Declare the same surface as statics, define the element yourself:

```js
class UserCard extends HgElement {
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

## `parseBinds(raw)`

The parser behind the `bind` attribute, exported for ecosystem packages that
paint with the same grammar — [hydrargyri-each](https://github.com/stamat/hydrargyri-each)
is the consumer. It lives here so the grammar cannot fork.

```js
parseBinds("user.name; price:value|money:currency");
// [{ path: ['user', 'name'], type: 'text', attr: null, format: null },
//  { path: ['price'], type: 'value', attr: null,
//    format: { name: 'money', args: [['currency']] } }]
```

A malformed entry warns and is skipped, the rest of the attribute parses — the
same forgiveness the scanner shows. Writing an element on hydrargyri alone never
needs it.

## Names that collide

An attribute or property whose camelCase name already answers on the element is
refused at definition, with a warning naming it, and the element keeps working
without it.

| The name                                      | Why it is refused                                     |
| --------------------------------------------- | ----------------------------------------------------- |
| `update`                                      | hydrargyri's own API — an accessor over it breaks repainting |
| `title`, `id`, `hidden`, `lang`               | platform natives, which would silently lose their behaviour |
| a method your `HgElement` subclass declares | the method is the thing you meant to call             |
| hydrargyri's internals (`handlers`, `_state`, …)   | the machinery the element rides on                    |

Failing at definition is the point. The alternative is a `TypeError` three
calls from the cause, in a stack that names none of the above.

## `[hg]`

The element wears an `hg` attribute once initialized. `x-el:not([hg])`
styles the not-yet-upgraded state — or hides nothing, since the markup
underneath is the fallback by design.
