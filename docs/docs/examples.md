---
layout: poops-docs-theme/docs
title: Examples
description: Stamping an HTML template into a custom element and binding a reactive model through it — the pattern, the ordering rule, and what it costs without JavaScript.
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

hydrargyri("demo-tpl-card", {
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
stampable, nobody scanning. The `hydrargyri()` call defines it, the browser upgrades
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
