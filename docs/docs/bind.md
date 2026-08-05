---
layout: poops-docs-theme/docs
title: bind
description: Where state lands — text, html, value, attr#name, prop#name, if and unless binds, paths into objects, and what a typo does.
order: 2
---

# `bind`

`bind="path[:type[#attr]][|formatter[:arg…]]"`, several entries separated by
`;`. The attribute holds **names**, never an expression — there is nothing in
it to evaluate, so nothing to sanitize and nothing for a Content Security
Policy to object to.

```html
<span bind="name"></span>
<span bind="user.name"></span>
<input bind="query:value">
<div bind="body:html"></div>
<a bind="url:attr#href;label">…</a>
```

## The types

| Type             | Writes                                 | Cleared by `null`                                             |
| ---------------- | -------------------------------------- | ------------------------------------------------------------- |
| `text` (default) | `textContent`                          | empty string                                                  |
| `html`           | `innerHTML` — see [Limits](limits.html) | empty string                                                  |
| `value`          | `.value`, for form fields              | empty string                                                  |
| `attr#name`      | the named attribute via `setAttribute` | attribute removed; `false` removes too, `true` sets valueless |
| `prop#name`      | the named property, `el.name = value`  | written as `null` — a property has no removed state          |
| `if` / `if#condition` | toggles `hidden` — see [Conditions](#conditions) | `null` is falsy: hidden, unless the condition says otherwise |
| `unless` / `unless#condition` | the else leg — `if` inverted, same toggle | `null` is falsy: shown |

`undefined` is not a value and paints nothing — it is what a path into an object
that has not arrived yet returns, and leaving the node alone is the only right
answer there. `null` is a real value and clears.

`prop#name` is the one that carries something an attribute cannot. An attribute
holds a string, so an array or an object bound through `attr#` arrives as
`[object Object]`; `prop#` assigns the value itself, which is how another custom
element gets handed its data from markup that already has it:

```html
<sales-report>
  <my-chart bind="quarters:prop#series"></my-chart>
</sales-report>
```

It writes what it is given and checks nothing — the property need not be
declared, and `bind="x:prop#innerHTML"` is `:html` wearing another name, under
the same [threat model](limits.html#sanitizing): bind your own state, never
user input.

Three types on one element, doing three different jobs:

<!-- demo -->

```html
<demo-badge label="draft">
  <label>Label <input on="input:relabel" bind="label:value"></label>
  <p><span bind="label">draft</span> <em bind="tone:attr#data-tone;tone"></em></p>
  <button on="click:toggle">Toggle tone</button>
</demo-badge>
```

```js demo
hg("demo-badge", {
  attributes: ["label", "tone"],
  handlers: {
    relabel(e, el) { el.label = e.target.value || null },
    toggle(e, el) { el.tone = el.tone === "warn" ? null : "warn" }
  }
});
```

The `<em>` carries two entries for one key — `tone:attr#data-tone;tone` — so it
gets the attribute and the text from the same assignment. Press **Toggle tone**
twice: `data-tone="warn"` appears and then goes, because `null` removes an
`attr` bind's attribute rather than setting it to the string `"null"`. That is
what makes an `attr` bind usable as a CSS hook.

`attr#class` is the one to write carefully. It goes through `setAttribute` like
every other `attr` bind, so it **replaces** the class list rather than adding to
it — the classes the author wrote are gone from the first paint, silently, and
no warning marks the spot. Alpine's `:class` merges; this does not, and hydrargyri
will not grow a merging type when the hook above already does the job. Toggle an
attribute of your own and style that:

```html
<span bind="active:attr#data-active" class="switch"></span>
```

```css
.switch[data-active] { background: var(--accent); }
```

The class attribute stays the author's, which is the rule the rest of the
library keeps too.

Typing in the field writes state through `relabel`, and the `value` bind writes
it back into the field. That is not [two-way
binding](limits.html#two-way-binding) — it is one direction twice, and the
handler in the middle is the part you can put a breakpoint in.

## Conditions

An `if` bind toggles the platform's `hidden` attribute instead of writing a
value. Bare, it follows truthiness — the node shows while the key holds
something — and `unless` is the same toggle inverted, which makes a full
if/else out of two sibling nodes with no JavaScript at all:

```html
<p bind="items:if">…</p>
<p bind="items:unless">Nothing here.</p>
```

With a name after `#` either type asks a predicate from `conditions` instead —
defined like a handler, named from the markup, never evaluated:

<!-- demo -->

```html
<demo-stock items="3">
  <label>Items <input type="number" min="0" on="input:restock" bind="items:value"></label>
  <p bind="items:if">In stock: <span bind="items"></span></p>
  <p bind="items:if#isLow">Running low.</p>
  <p bind="items:unless">Sold out.</p>
</demo-stock>
```

```js demo
hg("demo-stock", {
  attributes: ["items"],
  handlers: {
    restock(e, el) { el.items = e.target.value || 0 }
  },
  conditions: {
    isLow: (n) => n > 0 && n < 3
  }
});
```

Type the stock down to two and **Running low.** joins the count; at zero both
truthy lines hide and `unless` shows the last. The bare types carry the
if/else; `isLow` is the part truthiness cannot say, which is what the registry
is for. A condition is called as `(value, element)` on every paint of its key
— the initial paint included, where an unassigned property is `null`, so a
condition owns every value the key can hold.

The dependency is named in the bind itself. That is why hydrargyri needs no
dependency tracking to know when to re-run a condition: repaint `items` and
`isLow` runs, and nothing else does. It is also the whole difference from an
evaluated `x-show` — the logic sits in a JS file where it can be tested, and
the markup carries only its name.

`unless#condition` inverts the predicate too. It parses for free and it is
yours to use, but `unless#isLow` is a double negation the next reader unpicks
at their own expense — naming the positive (`if#inStock`) reads better.

## Formatters

A bind paints the value as it holds it. A formatter is the named function that
shapes it on the way to the node — declared beside `handlers` and `conditions`,
named from the markup after a `|`, never evaluated:

<!-- demo -->

```html
<demo-price price="1499.99" currency="USD">
  <label>Price <input type="number" step="0.01" on="input:reprice" bind="price:value"></label>
  <p>Shown as <strong bind="price|money:currency"></strong></p>
  <button on="click:swap">Switch currency</button>
</demo-price>
```

```js demo
hg("demo-price", {
  attributes: ["price", "currency"],
  handlers: {
    reprice(e, el) { el.price = e.target.value || 0 },
    swap(e, el) { el.currency = el.currency === "USD" ? "EUR" : "USD" }
  },
  formatters: {
    money: (v, el, currency) =>
      new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v)
  }
});
```

The input and the `<strong>` read the same key: the `value` bind gets the raw
number to edit, the piped bind paints the shaped one. Without the pipe those
are two properties and a sync obligation at every write site. A formatter is
called as `(value, element, ...args)` on every paint of its key, and what it
returns is what lands in the node — through any of the value-painting types,
so `price:attr#data-price|money` shapes an attribute the same way.

Arguments after the name are **property paths, never literals** —
`money:currency` hands over the element's `currency`, and `money:settings.locale`
walks into an object like a bind path does. A literal would need parse rules —
is `2` a number, is `USD` a string? — and parse rules are the micro-syntax that
turns an attribute into a language. The place for a constant is a property or
an attribute, where it already has a type and devtools can see it; the place
for a baked-in one is JS, where `money` can close over it.

Naming an argument does one more thing: the bind registers under that key too.
Press **Switch currency** above — `price` never changes, yet the price repaints,
because `currency` is named in the bind. The markup declares its own
dependencies, which is why hydrargyri still tracks none.

The edges, each deliberate:

- **A formatter owns every value its key can hold** — the initial `null` of an
  unassigned property included, same contract as a condition. `undefined` is
  the one value it never sees: a path into an object that has not arrived
  paints nothing, formatter and all — and returning `undefined` paints nothing
  too, for the formatter that decides to leave the node alone.
- **One formatter per entry.** `price|a|b` warns and is skipped. Chaining in
  markup is the first step toward a pipeline language; a composition is one
  more named formatter in JS, where it can be tested.
- **`if` and `unless` take conditions, not formatters** — a toggle paints no
  value to shape. `count:if|pretty` warns and toggles on the raw truthiness.
- **A missing name warns at paint and paints the raw value** — never a wrong-
  looking blank over a typo. Warned at paint rather than scan because
  `formatters` is assignable at runtime — `el.formatters.money = fn` answers
  on the next repaint, like a condition does.

## Paths

The path may reach into an object: `bind="user.name"` reads `el.user`, then
`.name`. Only the first segment is the reactive key — `el.user = {…}` repaints
it, `el.user.name = 'x'` does not, and
[`update('user')`](api.html#updatekey-update) is the way back — unless the
model came from [`reactive()`](api.html#reactivemodel), which watches its own
mutations.

Depth is not limited, and a segment that is missing anywhere along the way is
`undefined`, which paints nothing. A path is a read, never a write: hydrargyri walks
it to find a value and never creates the objects on the way.

## When it goes wrong

An entry that cannot work warns in the console, naming the element and the
entry, and is skipped. The element's **other** binds keep painting.

| The mistake                          | What happens                                                          |
| ------------------------------------ | --------------------------------------------------------------------- |
| `bind="cout"` — a typo in the key    | warns that the element has no attribute or property by that name       |
| `bind="name:txt"` — unknown type     | warns with the list of types it expected                              |
| `bind="url:attr"` — `attr` with no `#name` | same warning; there is no attribute to write                    |
| `bind="rows:prop"` — `prop` with no `#name` | same warning; there is no property to write                    |
| `bind="price\|money:tax"` — an argument naming nothing the element owns | warns like a typo in the key, and the entry is skipped |
| `bind="price\|a\|b"` — a second `\|` | warns; one formatter per entry, chaining is not supported             |
| `bind="user.name"` before `user` exists | nothing painted, no warning — a path is allowed to be empty for now |
| `bind="count:if#missing"` — no condition by that name | warns at paint and leaves the node as authored — content is never hidden over a typo |
| `bind="price\|missing"` — no formatter by that name | warns at paint and paints the raw value |

Scan time catches what the author wrote: the typo'd key, the unknown type, the
argument naming nothing, the chained formatter. The missing condition and the
missing formatter are caught at paint instead, because both registries are
assignable at runtime and may be filled in later. And the path through a
missing branch warns never — that is a state of the world, and warning about
it every second of a page's life would be noise.

## `data-bind`

`data-bind` works identically, for markup that must satisfy a validator — `bind`
and `on` are non-standard attribute names, and some toolchains care. Where both
sit on one element the bare form wins.

```html
<span data-bind="name"></span>
```

## What is scanned, and when

Binds are collected when the element connects, from itself and every descendant
carrying `bind` or `data-bind` — except those inside a **nested** hydrargyri element,
which owns them instead. Nesting works, and neither element steals the other's
nodes.

A `bind` node inserted after that scan is not seen. Re-connecting the element
rescans everything, which is the documented way to pick up new DOM; see
[Limits](limits.html).
