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
hydrargyri("demo-greeter", {
  attributes: ["name"],
  handlers: {
    rename(e, el) { el.name = e.target.value || null }
  }
});
```

DOM to state goes through a handler you wrote; state to DOM through a bind.
Nothing writes back on its own — clear the field and `name` becomes `null`,
which removes the attribute, because `rename` says so and not because hydrargyri
decided.

## The signature

A handler is called as `(event, element)`. The first argument is the ordinary
DOM event, with `e.target` being the node that was clicked or typed in. The
second is the hydrargyri element that owns the handler — the thing whose state you
are about to change — which is rarely `e.target` and is the argument that saves
a `closest()` call in every handler.

Use the second argument, not `this`. A method on a subclass is called on the
element, so `this` is the element there — but a `handlers` entry is called on
the `handlers` object, so `this` is that object and `this.count` is
`undefined`. The argument is the same value in both cases, and it survives an
arrow function.

## How a name resolves

| Order | Where hydrargyri looks                              |
| ----- | ---------------------------------------------- |
| 1     | a method on the element — your `HgElement` subclass |
| 2     | the `handlers` object                          |
| 3     | nowhere: a warning on the first fire           |

First match wins, and only one of the two runs — a `handlers` entry cannot
double-fire behind a subclass method of the same name. An unknown name warns
when the event first fires rather than throwing, so a typo costs you a feature
and not the page.

## `data-on`

`data-on` works identically, for markup that must satisfy a validator. Where
both sit on one element the bare form wins.

## `@window` and `@document`

`on="resize@window:relayout"` and `on="click@document:close"` put the listener
on the global instead of the element, for the events that never reach it —
`resize` fires on `window`, a click that should close this menu happens
somewhere else entirely. The handler still belongs to the element, still gets
`(event, element)`, and the listener is unhooked on disconnect like every
other one hydrargyri added — the leak that pattern usually costs is the part you
stop writing.

<!-- demo -->

```html
<demo-menu on="click@document:close">
  <button on="click:toggle">Menu</button>
  <p>The menu is <strong bind="state">closed</strong>. Click anywhere else in
  this preview to close it.</p>
</demo-menu>
```

```js demo
hydrargyri("demo-menu", {
  properties: ["state"],
  connected(el) {
    el.state = "closed";
  },
  handlers: {
    toggle(e, el) {
      e.stopPropagation(); // or the click closes what it just opened
      el.state = el.state === "open" ? "closed" : "open";
    },
    close(e, el) {
      el.state = "closed";
    }
  }
});
```

The `stopPropagation` is the pattern's one moving part, and it is the
platform's, not hydrargyri's: the opening click bubbles to `document` too, and
without the stop it closes the menu in the same breath.

An `@` pointing anywhere else — `click@body` — warns and is skipped, and the
entry's neighbours still wire. For an event many elements share, a global
listener per element is the wrong shape anyway: one module-scope listener
writing into a [`reactive()`](api.html#reactivemodel) model fans out to every
element holding it, and the elements carry no listeners at all.

## `command` events

`on="command:name"` hears
[Invoker Commands](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API)
like any other event, and a handler keyed by the exact command string
(`handlers: { '--add-item': fn }`) answers its command directly — see
[composition](composition.html#no-common-ancestor-at-all). An element with a
`--` key declared warns on a command it does not know; one without stays
silent, on the assumption an `on` listener like the above is handling them.

## What is scanned, and when

Handlers are wired when the element connects, on itself and every descendant
carrying `on` or `data-on` — except those inside a nested hydrargyri element, which
owns them instead.

Disconnecting removes every listener hydrargyri added. Re-connecting rescans and
wires them again, so an element moved across the page keeps working and does
not accumulate a second copy of its listeners. Listeners **you** added in
`connected` are yours to remove in `disconnected`.
