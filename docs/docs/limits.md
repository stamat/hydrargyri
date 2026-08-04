---
layout: poops-docs-theme/docs
title: Limits
description: What salis will not do, why each refusal is deliberate, and the threat model for :html binds.
order: 5
---

# What salis does not do

Each of these is a decision, not a gap waiting for a pull request. The
reasoning is here so you can tell whether the trade is one you want, before you
build on it.

## Implicit deep reactivity

Setters notice assignment, not mutation. `el.user = {…}` repaints;
`el.user.name = 'x'` does not, until [`update('user')`](api.html#updatekey-update)
— or until the model came from [`reactive()`](api.html#reactivemodel), which is
the one door, and it only opens by name.

What stays refused is the implicit version: salis never wraps an object you
assigned, and will not grow dependency tracking, computed values or effects. A
proxy has a real cost — the thing in your debugger is a membrane, not your
data, and identity checks against the raw original fail — so it is a cost you
take on purpose, per model, never one the library spreads over everything you
touch.

## Two-way binding

DOM to state goes through a handler you wrote — `on="input:rename"` — never
behind your back. A `value` bind writes state **into** a field and never reads
it back out.

The version that reads back is four lines and would remove `rename` from the
[greeter](on.html). It would also mean the field and the state disagree for as
long as it takes an `input` event to fire, and that whichever of the two you
are debugging, the other one is writing to it.

## Late DOM

Binds and handlers are scanned when the element connects. A `bind` node inserted
afterwards is not seen.

Re-connecting the element rescans everything, which is the documented way
through: move it, replace its children, put it back. A `MutationObserver` per
element would make this automatic and would also make every unrelated DOM change
in the subtree cost a rescan.

## Sanitizing

`:html` is `innerHTML`, verbatim.

**The contract: bind values are your state, not user input.** Anything reaching
a `:html` bind is executed as markup by the browser, so a value you did not
write belongs in a `text` bind — which goes through `textContent` — or an `attr`
bind, which goes through `setAttribute`. Both are inert by construction: markup
arriving through them stays text, and `salis.test.js` holds a test proving it.

Salis will not add a sanitizer. A sanitizer that is wrong is worse than none,
because it reads as a guarantee; the platform's own
[`setHTML`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setHTML) is
the right place for that job, and it is not salis's to reimplement while it
lands.

## A framework's worth of everything else

No templating, no virtual DOM, no components with slots, no router, no store,
no plugin ecosystem. Salis writes values into nodes that already exist; it never
creates, reorders, or diffs them. If you need a page built out of data, you
need one of the tools on the [comparison table](../index.html#against-the-alternatives),
and that is not a defeat.

## What it does do carefully

**It waits.** During parse an element defers its scan to `DOMContentLoaded`, so
it never binds against half its children. Load the script `defer` or as a module
and this costs nothing.

**It warns instead of throwing.** A bad bind, an unknown handler, a name that
collides with the platform — each one warns, is skipped, and leaves the rest of
the element working. A page that half-works is worth more than a page that
stopped.

**It leaves the markup readable.** The fallback content between the tags is what
a reader gets before the script arrives, and if it never arrives, they never
know.
