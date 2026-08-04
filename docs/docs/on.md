---
layout: poops-docs-theme/docs
title: on
description: What fires — event names in markup, how a handler name resolves, and the (event, element) signature.
order: 3
---

# `on`

`on="event:name"`, several separated by `;` — `on="focus:note;input:note"`.
Like [`bind`](bind.html), the attribute holds a **name**, never code. The event
name is whatever `addEventListener` accepts, which includes your own custom
events.

<!-- demo -->

```html
<demo-greeter name="stranger">
  <label>Name <input on="input:rename"></label>
  <p>Hello, <span bind="name">stranger</span>!</p>
</demo-greeter>
```

```js demo
salis("demo-greeter", {
  attributes: ["name"],
  handlers: {
    rename(e, el) { el.name = e.target.value || null }
  }
});
```

DOM to state goes through a handler you wrote; state to DOM through a bind.
Nothing writes back on its own — clear the field and `name` becomes `null`,
which removes the attribute, because `rename` says so and not because salis
decided.

## The signature

A handler is called as `(event, element)`. The first argument is the ordinary
DOM event, with `e.target` being the node that was clicked or typed in. The
second is the salis element that owns the handler — the thing whose state you
are about to change — which is rarely `e.target` and is the argument that saves
a `closest()` call in every handler.

Use the second argument, not `this`. A method on a subclass is called on the
element, so `this` is the element there — but a `handlers` entry is called on
the `handlers` object, so `this` is that object and `this.count` is
`undefined`. The argument is the same value in both cases, and it survives an
arrow function.

## How a name resolves

| Order | Where salis looks                              |
| ----- | ---------------------------------------------- |
| 1     | a method on the element — your `SalisElement` subclass |
| 2     | the `handlers` object                          |
| 3     | nowhere: a warning on the first fire           |

First match wins, and only one of the two runs — a `handlers` entry cannot
double-fire behind a subclass method of the same name. An unknown name warns
when the event first fires rather than throwing, so a typo costs you a feature
and not the page.

## `data-on`

`data-on` works identically, for markup that must satisfy a validator. Where
both sit on one element the bare form wins.

## What is scanned, and when

Handlers are wired when the element connects, on itself and every descendant
carrying `on` or `data-on` — except those inside a nested salis element, which
owns them instead.

Disconnecting removes every listener salis added. Re-connecting rescans and
wires them again, so an element moved across the page keeps working and does
not accumulate a second copy of its listeners. Listeners **you** added in
`connected` are yours to remove in `disconnected`.
