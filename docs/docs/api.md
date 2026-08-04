---
layout: poops-docs-theme/docs
title: API
description: salis(), SalisElement, typed attributes, reactive properties, the lifecycle hooks, update() and reactive().
order: 1
---

# API

Two entry points, and the second exists only because the first cannot carry
methods.

## `salis(name, options)` → class

Defines the custom element and returns its class. `options` as an array is
shorthand for `{ attributes: [...] }`, which is the shape most elements need.

| Option             | Type       | What it does                                                                                                                                                                                                    |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attributes`       | `Array`    | Observed attributes. Each becomes a typed camelCase property reflected to the attribute — `user-name` is reachable as `el.userName`.                                                                            |
| `properties`       | `Array`    | Reactive properties that live only in JS, never written to an attribute.                                                                                                                                        |
| `handlers`         | `Object`   | Named functions reachable from `on="event:name"`, called as `(event, element)`.                                                                                                                                 |
| `actions`          | `Object`   | [Invoker Command](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API) responses, keyed by the exact `command` string (`'--add-item'`), called as `(event, element)`. An unknown command warns only when actions are declared — an empty registry stays silent, since `on="command:name"` may be handling commands instead. Assignable at runtime: `el.actions['--x'] = fn`. |
| `connected`        | `Function` | Runs once the element is upgraded, scanned and painted, as `(element)`.                                                                                                                                         |
| `disconnected`     | `Function` | Runs when the element leaves the DOM, as `(element)`.                                                                                                                                                           |
| `attributeChanged` | `Function` | Runs on observed attribute changes as `(name, oldValue, newValue)` — parsed values, not strings. Attributes arriving from the markup are initial state, not changes; this stays silent until after `connected`. |

## Attribute values are typed

`count="5"` reads back as `5`, `active` with no value as `true`, an absent
attribute as `null`. Setting `false` or `null` removes the attribute, `true`
sets it valueless. The attribute is the only copy of the state — devtools edits
and salis writes cannot disagree, because there is nothing to disagree with.

| In the markup      | `el.thing` reads | Assigning        | The attribute becomes |
| ------------------ | ---------------- | ---------------- | --------------------- |
| `thing="5"`        | `5`              | `el.thing = 5`   | `thing="5"`           |
| `thing="hi"`       | `"hi"`           | `el.thing = "hi"`| `thing="hi"`          |
| `thing`            | `true`           | `el.thing = true`| `thing=""`            |
| absent             | `null`           | `el.thing = null`| removed               |
|                    |                  | `el.thing = false`| removed              |

Coercion is by value, not intent: `zip="01102"` reads back as the number
`1102`, and the leading zero is gone. A value that must stay a string keeps a
non-numeric character in it, or is read through `getAttribute`, where salis
never touches it.

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
salis("demo-clock", {
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
element alive. Salis unhooks the listeners it added; the ones you started are
yours to stop.

Data that arrives late is the same story with an `await` in it: `connected`
can be `async`, and the fallback between the tags — there before the script,
there before the data — is the loading state, already written.

<!-- demo -->

```html
<demo-lazy>
  <p><strong bind="user.name">Loading…</strong> <span bind="user.role"></span></p>
  <button on="click:reload">Reload</button>
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

salis("demo-lazy", {
  properties: ["user"],
  async connected(el) {
    el.user = await fetchUser();
  },
  handlers: {
    async reload(e, el) {
      el.user = await fetchUser();
    }
  }
});
```

No spinner machinery: a path through `null` paints nothing, so the placeholder
holds until assignment repaints it. Press **Reload** and the old name stays put
while the new one is in flight — a missing branch never blanks a node, which
is stale-while-refetching for free. Salis ignores the promise `connected`
returns; a fetch that can fail is yours to `catch`.

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
the reactivity salis deliberately does not have: mutation _inside_ an object
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
salis("demo-profile", {
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

salis("demo-crew", {
  properties: ["user"],
  connected(el) {
    el.user = user;
  },
  handlers: {
    promote(e, el) {
      el.user.role = "director of design"; // no update() — both cards repaint
    }
  }
});
```

The rules, and each is load-bearing:

- **The proxy is the model.** `reactive` returns a deep proxy; mutating the
  raw original notifies nobody. Create the model reactive and pass the proxy
  around — never keep the raw.
- **Only plain objects and arrays wrap.** A Map, a Date, a class instance
  warns and comes back unwrapped — their methods reach for internal slots a
  proxy does not have.
- **Repaints are per key, not per path.** Any mutation inside the model
  repaints everything bound to its key on each subscribed element. There is no
  dependency tracking; at salis scale a repaint is a few `textContent` writes.
- **Models do not merge.** A reactive model assigned inside another keeps its
  own subscribers — mutation notifies the model it was mutated through.
- **Assignment subscribes, disconnect unsubscribes.** An element removed from
  the DOM stops repainting; reconnecting catches it up. Async data, reactive
  models and element lifecycle compose without coordination code.

## `SalisElement`

The base class behind the factory, for elements that need methods of their own.
Declare the same surface as statics, define the element yourself:

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

## Names that collide

An attribute or property whose camelCase name already answers on the element is
refused at definition, with a warning naming it, and the element keeps working
without it.

| The name                                      | Why it is refused                                     |
| --------------------------------------------- | ----------------------------------------------------- |
| `update`                                      | salis's own API — an accessor over it breaks repainting |
| `title`, `id`, `hidden`, `lang`               | platform natives, which would silently lose their behaviour |
| a method your `SalisElement` subclass declares | the method is the thing you meant to call             |
| salis's internals (`handlers`, `_state`, …)   | the machinery the element rides on                    |

Failing at definition is the point. The alternative is a `TypeError` three
calls from the cause, in a stack that names none of the above.

## `[salis]`

The element wears a `salis` attribute once initialized. `x-el:not([salis])`
styles the not-yet-upgraded state — or hides nothing, since the markup
underneath is the fallback by design.
