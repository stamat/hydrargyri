---
layout: poops-docs-theme/docs
title: Examples
description: Stamping an HTML template into a custom element, and a todo list an ordinary form adds to — the patterns, their ordering rules, and what each costs without JavaScript.
order: 5
---

# Examples

Patterns built from pieces the reference already documents. Each one runs live,
and each one names its trade.

## Stamp an HTML template into a custom element

The same card markup on a page five times is four copies too many — and hydrargyri
will not generate it for you: [the markup is the
author's](limits.html#a-frameworks-worth-of-everything-else), and a library that
stamps templates on its own is halfway to being a renderer. Nothing stops *your*
code from being the author, though. The platform's
[`<template>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template)
holds inert markup; clone it into the element **before the element is defined**,
and by the time hydrargyri scans on connect, the clone is ordinary markup — binds and
all — like any you could have typed.

The trade first, because it is real: **template content does not render without
JavaScript.** A page whose markup lives in templates shows nothing when the
script is blocked, which spends the progressive-enhancement guarantee the rest
of hydrargyri keeps. Repeated markup that must survive scriptless belongs to the
server — a partial, an include; the template is for markup that only means
something once the script runs anyway.

<!-- demo -->

```html
<template id="crew-card">
  <h3 bind="user.name">…</h3>
  <p bind="user.role">…</p>
  <button on="click:promote">Promote</button>
</template>

<demo-tpl-card></demo-tpl-card>
<demo-tpl-card></demo-tpl-card>
```

```js demo
const tpl = document.getElementById("crew-card");
for (const el of document.querySelectorAll("demo-tpl-card")) {
  el.append(tpl.content.cloneNode(true));
}

const user = reactive({ name: "Aja", role: "site design manager" });

hg("demo-tpl-card", {
  properties: { user },
  handlers: {
    promote() {
      user.role = user.role === "director of design"
        ? "site design manager"
        : "director of design";
    }
  }
});
```

The ordering is the whole trick: **clone before define.** Until
`customElements.define` runs, `<demo-tpl-card>` is an unknown element — inert,
stampable, nobody scanning. The `hg()` call defines it, the browser upgrades
every instance on the page, and each one connects and [scans whatever children
it has at that moment](bind.html#what-is-scanned-and-when) — which now includes
the clone. An element created later follows the same rule from the other side:
fill it while it is detached, insert it, and the scan on connect sees
everything. Stamp into an element already connected and you are in [late
DOM](limits.html#late-dom) territory — re-connecting rescans.

## Bind a reactive model through the stamped markup

The binds inside the clone are ordinary binds, so everything the reference says
about them holds unchanged — including
[`reactive()`](api.html#reactivemodel). Above, one model feeds both cards
through the object form of `properties` — [the define-time
share](api.html#sharevalues) — and **Promote** mutates the model with no element
reference in sight: both cards repaint, because mutation through the proxy
notifies every element holding it.

None of that is template-specific, which is the point. Stamped markup earns no
special machinery and needs none — the guarantee sits
in the test suite under its own sentence: *markup stamped from a template
before define binds like authored markup*.

## A todo list a form adds to

A list the reader grows is the case hydrargyri hands off: rows for items nobody has
seen yet cannot be written into the page, so [`<hg-each>`](each.html) clones the
template once per item. Everything around it is already documented — a
[`reactive()`](api.html#reactivemodel) array both the rows and the counter
watch, and a `<form>` that is nothing but a form.

<!-- demo -->

```html
<demo-todo>
  <form on="submit:add">
    <label>New task <input name="task" autocomplete="off"></label>
    <button>Add</button>
  </form>

  <hg-each>
    <ul>
      <template>
        <li>
          <label><input type="checkbox" bind="done:prop#checked" on="change:toggle">
            <span bind="title"></span></label>
          <button on="click:drop">Delete</button>
        </li>
      </template>
      <li><label><input type="checkbox" checked> Read the docs</label></li>
    </ul>
  </hg-each>

  <p><b bind="todos.length">1</b> on the list</p>
</demo-todo>
```

```js demo
const todos = reactive([
  { id: 1, title: "Read the docs", done: true }
]);
let nextId = 2;

hg("demo-todo", {
  properties: { todos },
  connected(el) {
    el.querySelector("hg-each").items = todos;
  },
  handlers: {
    add(e) {
      e.preventDefault();
      const field = e.target.elements.task;
      const title = field.value.trim();
      if (!title) return;
      todos.push({ id: nextId++, title, done: false });
      e.target.reset();
      field.focus();
    },
    toggle(e) {
      e.target.closest("[hg-row]").hgItem.done = e.target.checked;
    },
    drop(e) {
      todos.splice(+e.target.closest("[hg-row]").getAttribute("hg-row"), 1);
    }
  }
});
```

Three handlers, and the platform writes most of them. `add` reads the field
through `e.target.elements.task`, empties it with `reset()` and puts the caret
back with `focus()` — hydrargyri's contribution is the `push`, and the row appears
because the array is `reactive()`. `preventDefault` is the line that keeps the
page: without it the form submits and the demo reloads.

The two row handlers reach their item two different ways, because they need two
different things. `toggle` needs the item, and hg-each already put it on the row
as [`hgItem`](each.html#binds-resolve-into-the-item) — writing `done` through it
writes through the proxy, so the checkbox repaints itself. `drop` needs the
position instead, and that is what [`hg-row`](each.html#binds-resolve-into-the-item)
carries. Neither handler is declared on `<hg-each>`: both [fall
through](each.html#handlers-and-conditions-fall-through) to `<demo-todo>`, which
owns the data.

The counter is outside `<hg-each>` and binds `todos.length` on `<demo-todo>` —
one array, two elements watching it, and neither knows the other exists.

Two trades. **No `key`**, so every repaint clones fresh rows: right for a
checkbox and a button, wrong the moment a row holds a half-typed input or a
playing video — [`key`](each.html#key-and-rows-that-keep-their-nodes) is the
answer there. And **the model is memory**: reload and the list is the one row
the markup ships with. Persistence is a `localStorage` write in the same three
handlers, or a `fetch` — neither is hydrargyri's business, and neither changes a
line of the markup above.

With the script blocked, the fallback row still renders and the form still
submits, because both are the page's own. What a server does with that POST is
the server's business — but nothing here is a widget impersonating a form.
