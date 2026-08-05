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

**The samples on this page do not run.** Every other preview on this site loads
the library and defines its own element; `<hg-each>` ships in a package this
site does not bundle, so what follows is markup to copy rather than a frame to
edit.

## The shape

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

```js
import "hydrargyri-each";

document.querySelector("hg-each").items = [
  { name: "Ada", role: "admin" },
  { name: "Grace" }
];
```

That `<li>Ada — admin</li>` is not an example of the output, it is the page
working before the script arrives. A `<template>` renders nothing by itself, so
a reader without JavaScript keeps the server's rows, and the first assignment of
`items` replaces them — the same guarantee the rest of hydrargyri makes, kept the
same way.

## Install

Not on npm yet. The package is written and has a test suite; nothing is
published, so the install lines in [its
README](https://github.com/stamat/hydrargyri-each#install) describe the shape of the
release rather than something to pull today. One thing worth knowing before it
lands: its `dist/` keeps `hydrargyri` external, so a CDN setup needs an import map
naming the one shared copy — two copies of hydrargyri cannot see each other's
elements.

## `items`, and what a value paints

`items` is an ordinary hydrargyri property, so it is assigned in JavaScript and
never through an attribute.

| `items`                             | What paints                                          |
| ----------------------------------- | ---------------------------------------------------- |
| `null`, never assigned              | nothing — the fallback rows stand                    |
| an array                            | one clone per item, replacing whatever is there      |
| `null` or `[]`, after an assignment | no rows — the fallback is gone for good              |
| anything else                       | a warning, and the rows already standing are left    |

Assign a [`reactive()`](api.html#reactivemodel) array and mutation repaints:
`items.push(…)` grows a row with no second call. A plain array needs
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

## Binds resolve into the item

The whole [bind grammar](bind.html) works inside a row — `text`, `html`,
`value`, `attr#name`, `if`, `unless`, entries separated by `;` — with paths
walked from the item rather than from the element: `bind="user.name"` reads
`item.user.name`, and `bind="."` is the item itself, for arrays of primitives. A
path that hits nothing leaves the node as authored, [as
everywhere](bind.html#when-it-goes-wrong).

There is no index bind and no scope chain: a row sees its own item and nothing
above it, and numbering wants a CSS counter. What a row does get is its
coordinates on the root element — `hg-row="0"`, the index, also a styling hook —
and the item itself as an `hgItem` property:

```js
handlers: {
  remove(e, el) {
    const row = e.target.closest("[hg-row]");
    el.list.splice(+row.getAttribute("hg-row"), 1); // a reactive() list repaints
  }
}
```

## Handlers and conditions fall through

`<hg-each>` declares no handlers of its own, and the element holding the data
usually owns what its rows do. So `on="click:remove"` inside a row asks hg-each
first and then the closest hydrargyri ancestor, and the handler runs with the
element it was found on as its second argument — the [`(event, element)`
signature](on.html#the-signature) unchanged. Named conditions
(`bind="done:if#overdue"`) resolve the same way. A name nothing answers warns,
as it does [on any element](on.html#how-a-name-resolves).

## What it does not do

- **Keyed diffing, yet.** Every repaint clears the rows and clones again, which
  discards row DOM state: focus, a half-typed input, a playing video. A `key`
  attribute is reserved for the keyed version and does nothing today, so a list
  the user types into while it repaints wants Alpine or Lit instead. The
  package's README puts it [against those
  alternatives](https://github.com/stamat/hydrargyri-each#against-the-alternatives)
  row by row, losing row included.
- **Sorting, filtering, pagination.** The array is yours: transform it in
  JavaScript and assign the result. The alternative is a query language growing
  inside an attribute.
- **Nested lists, declaratively.** A [bind](bind.html) writes text, markup, a
  form field's `value` or an attribute — never an arbitrary property, and
  `items` is one. So an `<hg-each>` inside a row is handed its list in
  JavaScript, through the row's `hgItem`; no bind carries an item's array into
  the inner element.
- **Sanitizing.** `:html` in a row is `innerHTML`, verbatim — [the same threat
  model](limits.html#sanitizing), so bind your own state to it and never user
  input.
- **Creating anything but rows.** Outside the rows region, `<hg-each>` is an
  ordinary hydrargyri element and your markup stays yours.
