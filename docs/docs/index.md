---
layout: poops-docs-theme/docs
title: Getting started
description: What a hydrargyri element is made of — the definition, the binds, the handlers — and where the rest of the reference lives.
order: 0
---

# Getting started

A hydrargyri element is three things, and one screen holds all three.

## 1. The markup

Yours. Hydrargyri writes into the nodes that are already there — `bind` says where a
value lands, `on` says what a name fires.

<!-- demo -->

```html
<demo-counter count="0">
  <button on="click:decrement" aria-label="Decrement">−</button>
  <output bind="count">0</output>
  <button on="click:increment" aria-label="Increment">+</button>
</demo-counter>
```

```js demo
hydrargyri("demo-counter", {
  attributes: ["count"],
  handlers: {
    increment(e, el) { el.count += 1 },
    decrement(e, el) { el.count -= 1 }
  }
});
```

Edit the markup above — the preview re-renders. Both attributes hold **names**,
never expressions: there is nothing in them to evaluate, which is why they cost
a Content Security Policy nothing.

## 2. The definition

The JavaScript beside that markup is the whole of it. `hydrargyri(name, options)`
defines a custom element and returns its class; it is called once in a module —
`import hydrargyri from "hydrargyri"` — and the tag works everywhere it appears on the
page.

`attributes` are observed: each becomes a typed camelCase property reflected to
the DOM, so `el.count` reads the attribute and assigning to it writes the
attribute back. `handlers` are named functions, and nothing else can reach them.

## 3. What happens without the script

The `0` between the buttons is what a reader sees before the script arrives, and
what they keep if it never does. Hydrargyri has no fallback mode, because the fallback
is the markup itself — this is the whole reason the library keeps your HTML
instead of generating it.

[`[hg]`](api.html#hg) is the hook if you do want to style the
not-yet-upgraded state.

The sidebar carries the rest of the reference. Read [Limits](limits.html)
before you build on this — it is the shortest way to find out whether the trade
hydrargyri makes is one you want.
