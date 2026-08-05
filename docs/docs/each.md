---
layout: poops-docs-theme/docs
title: hg-each
description: List rendering, in a package of its own — hg-each clones the template you wrote once per item, with binds resolved into the item.
order: 7
---

# `<hg-each>`

Lists are where markup-first stops working. Every state of a counter can be
written into the page; a row per item of an array nobody has seen yet cannot —
somebody has to create nodes, and hydrargyri [never
does](limits.html#a-frameworks-worth-of-everything-else).

[hydrargyri-each](https://github.com/stamat/hydrargyri-each) is that somebody, kept in
a package of its own so the refusal here stands unamended: `<hg-each>` clones an
author-written `<template>` once per item, painting the clone with the same
`bind` grammar hydrargyri parses — [`parseBinds`](api.html#parsebindsraw) is exported
for exactly this, so the grammar cannot fork.

## The shape

<!-- demo -->

```html
<hg-each>
  <ul>
    <template>
      <li><b bind="name"></b> — <span bind="role">member</span></li>
    </template>
    <li><b>Ada</b> — <span>admin</span></li>
  </ul>
</hg-each>
```

```js demo
document.querySelector("hg-each").items = [
  { name: "Ada", role: "admin" },
  { name: "Grace" }
];
```

That `<li>Ada — admin</li>` is not an example of the output, it is the page
working before the script arrives. A `<template>` renders nothing by itself, so
a reader without JavaScript keeps the server's rows, and the first assignment of
`items` replaces them — the same guarantee the rest of hydrargyri makes, kept the
same way. Grace carries no `role`, so that row keeps the word the template was
authored with.

## Install

```bash
npm install hydrargyri hydrargyri-each
```

```js
import "hydrargyri-each"; // defines <hg-each>; hydrargyri is a peer, installed beside it
```

From a CDN its `dist/` keeps `hydrargyri` external, so an import map names the one
shared copy:

```html
<script type="importmap">
  { "imports": { "hydrargyri": "https://cdn.jsdelivr.net/npm/hydrargyri/dist/hydrargyri.mjs" } }
</script>
<script type="module">
  import "https://cdn.jsdelivr.net/npm/hydrargyri-each/dist/hydrargyri-each.mjs";
</script>
```

Two copies of hydrargyri cannot see each other's elements, and the failure is
quiet rather than loud: an `<hg-each>` inside another hydrargyri element loses its
own binds to that element, and a [`reactive()`](api.html#reactivemodel) model
assigned to `items` never repaints. The previews on this page run with one copy
of each package already on the frame, which is why their fences carry no import
line.

## `items`, and what a value paints

`items` is an ordinary hydrargyri property, so it is assigned in JavaScript and
never through an attribute.

| `items`                                    | What paints                                       |
| ------------------------------------------ | ------------------------------------------------- |
| `null`, never assigned                     | nothing — the fallback rows stand                 |
| an array                                   | one clone per item, replacing whatever is there   |
| a plain object                             | one clone per entry, the value as the item        |
| `null`, `[]` or `{}`, after an assignment  | no rows — the fallback is gone for good           |
| anything else                              | a warning, and the rows already standing are left |

An object paints in `Object.entries` order, with its key reachable in the row as
`$key`. A `Map`, a `Set` or a class instance is the "anything else" that warns:
what an entry means there is that type's own question, and guessing is how a
list quietly paints the wrong thing.

Assign a [`reactive()`](api.html#reactivemodel) array or object and mutation
repaints: `items.push(…)` grows a row with no second call. A plain one needs
[`update("items")`](api.html#updatekey-update), exactly as anywhere else.

## The rows region

Everything beside the template, inside the template's parent, is hg-each's to
clear and repaint — elements, text and comments alike, fallback rows before the
first paint and clones after. Anything that must survive goes outside that
parent:

```html
<hg-each>
  <p bind="items.length">3</p>   <!-- hg-each's own bind, safe here -->
  <p bind="items.length:unless">Nothing here yet</p>
  <ul>
    <template><li bind="."></li></template>
    <li>fallback</li>            <!-- rows region: replaced at the first paint -->
  </ul>
</hg-each>
```

The second bind is the empty state, and it takes nothing new: `items.length` is
hg-each's own property, so [`unless`](bind.html) hides the node while the list
has items and shows it while it does not.

`<template>` is script-supporting content, valid directly inside `<ul>`,
`<tbody>` and `<select>` — which is why `<hg-each>` wraps the list container
instead of sitting between `<ul>` and its `<li>`s, where no element is allowed.

An `<hg-each>` with no `<template>` child — or one holding text with no element
to clone, which no row bind could reach — warns and leaves the markup as
authored, the same [warn and keep
working](limits.html#what-it-does-instead-of-failing) the core does. A broken
list degrades to the server-rendered one, never to an empty container.

## A template from elsewhere

`template="id"` names a template anywhere on the page, for row markup two lists
share. The id is bare, as in `list=` and `for=` — a name, not a selector — and
it is looked up at the first paint rather than at upgrade, so the template may
be authored after the element that uses it.

```html
<template id="card"><article><h3 bind="title"></h3></article></template>

<hg-each template="card">
  <article><h3>Server-rendered fallback</h3></article>
</hg-each>
```

The trade is the region. With no template inside to divide it, the whole of
`<hg-each>` is the rows region — its own binds and an empty-state node
included, so those go outside it, and an inline `<template>` beside the
attribute warns, because the first paint would clear it away. An id naming
nothing, or naming something that is not a `<template>`, warns once and leaves
the markup as authored.

## Binds resolve into the item

The whole [bind grammar](bind.html) works inside a row — `text`, `html`,
`value`, `attr#name`, `prop#name`, `class#name`, `if`, `unless`, entries
separated by `;` — with paths
walked from the item rather than from the element: `bind="user.name"` reads
`item.user.name`, and `bind="."` is the item itself, for arrays of primitives. A
path that hits nothing leaves the node as authored, [as
everywhere](bind.html#when-it-goes-wrong).

A row's own coordinates live in a `$` namespace beside the item's fields:
`bind="$index"` is its position and `bind="$key"` its object key, nothing over
an array. A plain name always means a field of the item, so an item carrying its
own `$index` never shadows the coordinate.

There is still no scope chain: a row sees its item and those two names and
nothing above it, an inner hg-each's rows never see the outer item, and any
other `$` name warns rather than resolving to nothing. The same coordinates
reach the DOM on the root element — `hg-row="0"`, the position, also a styling
hook, and the position even over an object, where the key stays in `$key` — with
the item itself as an `hgItem` property. `hg-row` is how a button inside a row
says which row fired it, [below](#handlers-and-conditions-fall-through).

## `key`, and rows that keep their nodes

Without `key` every repaint clones from scratch, which is fine for a list nobody
is touching and wrong for one holding focus, a half-typed input or a playing
video. `key` names what makes a row itself, and then a row whose key comes back
keeps the nodes it already had: they are moved into the new order and repainted
in place, new keys arrive as clones, and vanished keys take their rows with
them.

```html
<hg-each key="id">          <!-- a path into the item -->
<hg-each key="$key">        <!-- the object's own keys -->
<hg-each key=".">           <!-- the item itself, for arrays of primitives -->
```

The path is the [bind grammar](bind.html) again, resolved against the item, so
`key="user.id"` walks. Nothing keeps a shadow copy of the DOM to compare
against — the nodes that move are the real ones. Two rows claiming one key warns
and clones the later one, a path resolving to nothing warns and falls back to
re-cloning, and both warn once per element rather than once per repaint.
`hg-row` keeps following the position, so a handler reading it after a reorder
reads where the row is now.

## Handlers and conditions fall through

`<hg-each>` declares no handlers of its own, and the element holding the data
usually owns what its rows do. So `on="click:dismiss"` inside a row asks hg-each
first and then the closest hydrargyri ancestor, and the handler runs with the
element it was found on as its second argument — the [`(event, element)`
signature](on.html#the-signature) unchanged. Named conditions
(`bind="done:if#overdue"`) resolve the same way. A name nothing answers warns,
as it does [on any element](on.html#how-a-name-resolves).

<!-- demo -->

```html
<demo-roster>
  <hg-each>
    <ul>
      <template>
        <li><b bind="name"></b> — <span bind="role">member</span>
          <button on="click:dismiss">Dismiss</button></li>
      </template>
      <li><b>Ada</b> — <span>admin</span></li>
    </ul>
    <p bind="items.length:unless">Nobody left.</p>
  </hg-each>
  <button on="click:hire">Hire</button>
</demo-roster>
```

```js demo
const crew = reactive([
  { name: "Ada", role: "admin" },
  { name: "Grace" }
]);
const bench = ["Katherine", "Dorothy", "Margaret", "Mary"];

hg("demo-roster", {
  connected(el) {
    el.querySelector("hg-each").items = crew;
  },
  handlers: {
    hire() { crew.push({ name: bench[crew.length % bench.length] }) },
    dismiss(e) {
      crew.splice(+e.target.closest("[hg-row]").getAttribute("hg-row"), 1);
    }
  }
});
```

Neither button is hg-each's. **Hire** sits on `<demo-roster>` and fires there;
**Dismiss** sits in a row, finds no `dismiss` on hg-each, and walks up to the
same element — which is why one `handlers` object serves both. The list is
[`reactive()`](api.html#reactivemodel), so `push` and `splice` repaint with no
call to `update`, and `<hg-each>` never learns about the data twice: `connected`
hands it the array once.

The name is `dismiss` and not `remove` because [a method on the element
wins](on.html#how-a-name-resolves), and every element already has `remove()` —
`on="click:remove"` deletes the node it fired from instead of reaching your
`handlers`.

Dismiss the last row and **Nobody left** appears. That `<p>` is inside
`<hg-each>` and outside the `<ul>`, so it survives every repaint, and
`items.length` is hg-each's own property — the empty state needs nothing new.

## What it does not do

- **Diffing.** [`key`](#key-and-rows-that-keep-their-nodes) moves and repaints
  the real nodes it already has; nothing keeps a shadow copy of the DOM to
  compare against. Without `key` a repaint clears the rows and clones again,
  which discards row DOM state: focus, a half-typed input, a playing video. The
  package's README puts hg-each [against the
  alternatives](https://github.com/stamat/hydrargyri-each#against-the-alternatives)
  row by row.
- **Sorting, filtering, pagination.** The array is yours: transform it in
  JavaScript and assign the result. The alternative is a query language growing
  inside an attribute.
- **Nested lists, declaratively.** A row can hand its data to an ordinary
  custom element — `<my-chart bind="quarters:prop#series">` — because
  [`prop#name`](bind.html#the-types) writes the value itself. It cannot hand it
  to another `<hg-each>`: a bind on a hydrargyri element's own root [belongs to
  that element](bind.html#what-is-scanned-and-when), so the inner list would
  resolve `items` against its own state rather than the outer row's item. A
  nested `<hg-each>` is still fed in JavaScript, through the row's `hgItem`.
- **Sanitizing.** `:html` in a row is `innerHTML`, verbatim — [the same threat
  model](limits.html#sanitizing), so bind your own state to it and never user
  input.
- **Creating anything but rows.** Outside the rows region, `<hg-each>` is an
  ordinary hydrargyri element and your markup stays yours.
