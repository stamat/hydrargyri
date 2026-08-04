---
layout: poops-docs-theme/docs
title: bind
description: Where state lands — text, html, value and attr#name binds, paths into objects, and what a typo does.
order: 2
---

# `bind`

`bind="path[:type[#attr]]"`, several entries separated by `;`. The attribute
holds a **name**, never an expression — there is nothing in it to evaluate, so
nothing to sanitize and nothing for a Content Security Policy to object to.

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

`undefined` is not a value and paints nothing — it is what a path into an object
that has not arrived yet returns, and leaving the node alone is the only right
answer there. `null` is a real value and clears.

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
salis("demo-badge", {
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

Typing in the field writes state through `relabel`, and the `value` bind writes
it back into the field. That is not two-way binding — it is one direction twice,
and the handler in the middle is the part you can put a breakpoint in.

## Paths

The path may reach into an object: `bind="user.name"` reads `el.user`, then
`.name`. Only the first segment is the reactive key — `el.user = {…}` repaints
it, `el.user.name = 'x'` does not, and
[`update('user')`](api.html#updatekey-update) is the way back — unless the
model came from [`reactive()`](api.html#reactivemodel), which watches its own
mutations.

Depth is not limited, and a segment that is missing anywhere along the way is
`undefined`, which paints nothing. A path is a read, never a write: salis walks
it to find a value and never creates the objects on the way.

## When it goes wrong

An entry that cannot work warns in the console, naming the element and the
entry, and is skipped. The element's **other** binds keep painting.

| The mistake                          | What happens                                                          |
| ------------------------------------ | --------------------------------------------------------------------- |
| `bind="cout"` — a typo in the key    | warns that the element has no attribute or property by that name       |
| `bind="name:txt"` — unknown type     | warns with the list of types it expected                              |
| `bind="url:attr"` — `attr` with no `#name` | same warning; there is no attribute to write                    |
| `bind="user.name"` before `user` exists | nothing painted, no warning — a path is allowed to be empty for now |

The first three are author errors, caught at scan time. The fourth is a state
of the world, and warning about it every second of a page's life would be noise.

## `data-bind`

`data-bind` works identically, for markup that must satisfy a validator — `bind`
and `on` are non-standard attribute names, and some toolchains care. Where both
sit on one element the bare form wins.

```html
<span data-bind="name"></span>
```

## What is scanned, and when

Binds are collected when the element connects, from itself and every descendant
carrying `bind` or `data-bind` — except those inside a **nested** salis element,
which owns them instead. Nesting works, and neither element steals the other's
nodes.

A `bind` node inserted after that scan is not seen. Re-connecting the element
rescans everything, which is the documented way to pick up new DOM; see
[Limits](limits.html).
