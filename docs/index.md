---
layout: poops-docs-theme/prose
title: Hydrargyri
description: Reactive web components in the light DOM — declarative binds and handlers on markup you already wrote.
nav: false
---

# <span class="brand-mark">☿</span> Hydrargyri

Every reactive framework starts the same way: move your markup into our world.
Templates in JS, decorators that need a build step, expressions interpreted out
of attributes. The page you already had — the one that renders without any of
it — becomes the framework's output instead of your document.

Hydrargyri goes the other way. You keep the HTML. A custom element wraps the part
that changes, `bind` says where state lands, `on` says what fires, and the
script never loading leaves the page exactly as written.

<!-- demo -->

```html
<demo-greeter name="stranger">
  <label>Name <input on="input:rename"></label>
  <p>Hello, <span bind="name">stranger</span>!</p>
</demo-greeter>
```

```js demo
hg("demo-greeter", {
  attributes: ["name"],
  handlers: {
    rename(e, el) { el.name = e.target.value || null }
  }
});
```

Edit the markup above and it re-renders — that is the whole contract. Block the
script and it still greets a stranger, because hydrargyri never wrote that word.

No build step, no shadow DOM, no expression language — `bind` and `on` hold
names, never code. Quicksilver, in the alchemical sense: the volatile principle,
the one that moves while the body stays put. Your markup holds still; the values
are what run through it. It sits on
[book-of-spells](https://github.com/stamat/book-of-spells), same shelf as
[sulphuris](https://github.com/stamat/sulphuris) 🜍.

**[Read the docs →](docs/)**

## Against the alternatives

Like sulphuris, the value here is personal first: this is the wrapper I wanted
to exist, and it transfers to whoever shares the taste for markup-first pages.
If you want templating, two-way binding, or an ecosystem, the table says where
to go — those are fine tools and hydrargyri does not compete on their ground.

|                                                | Keeps your markup    | Custom elements      | Build step          | Logic in markup                    | Conditionals                  | Pick it when                                                |
| ---------------------------------------------- | -------------------- | -------------------- | ------------------- | ---------------------------------- | ----------------------------- | ----------------------------------------------------------- |
| [Catalyst](https://github.com/github/catalyst) | yes                  | yes                  | yes — TS decorators | no                                 | no — you write DOM code       | you already build with TypeScript                           |
| [Stimulus](https://stimulus.hotwired.dev)      | yes                  | no — its own runtime | no                  | no                                 | no — controller code toggles  | you want the mature ecosystem, especially around Rails      |
| [Alpine](https://alpinejs.dev)                 | yes                  | no                   | no                  | yes — JS expressions in attributes | yes — `x-if`, evaluated       | you want logic inline and accept the CSP cost               |
| [Lit](https://lit.dev)                         | no — templates in JS | yes                  | no, but expected    | no                                 | yes — ternaries in JS templates | you are building an app, not upgrading a page               |
| hydrargyri                                          | yes                  | yes                  | no                  | no                                 | named predicates, never eval  | the markup exists first and must survive without the script |

Hydrargyri loses on features to every row above: no templating, no two-way binding,
no plugin ecosystem. That is the trade, and [Limits](docs/limits.html) is the
page that spells it out rather than burying it.

Stimulus earns the honest footnote: same religion, different church. The same
names-in-markup creed, the same CSP-cleanliness, near-identical event wiring and
typed attribute-backed values. The doctrine splits on exactly two points —
`bind` paints declaratively where Stimulus targets are refs you repaint by hand,
and the component boundary is the platform's custom element instead of a runtime
with a registry, which is also why hydrargyri is 3 kB where Stimulus is 12. If
neither point matters to your project, go to their church; it is better run in
every other respect.

## Install

Not on npm yet — the commands below describe the shape of the release, not a
package you can pull today.

```bash
npm install hydrargyri
```

```js
import hg, { HgElement, reactive } from "hydrargyri";
```

Or straight from a CDN as a module, no install:

```html
<script type="module">
  import hg from "https://cdn.jsdelivr.net/npm/hydrargyri/dist/hydrargyri.mjs";
</script>
```

Nothing is registered by importing hydrargyri — it is a factory, not a bundle of
elements. You call it once per tag, and the tag upgrades wherever it appears.

## The whole surface

| Page                                 | What it covers                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| [Getting started](docs/)             | the three parts of a hydrargyri element, in one screen                                  |
| [API](docs/api.html)                 | `hg()`, `HgElement`, typed attributes, `properties`, lifecycle, `update()`, `reactive()`, `share()` |
| [bind](docs/bind.html)               | where state lands: `text`, `html`, `value`, `attr#name`, `if` / `unless`, and paths into objects |
| [on](docs/on.html)                   | what fires: event names, handler resolution, the `(event, element)` signature      |
| [Composition](docs/composition.html) | elements talking to each other — events up, attributes down, no bus                |
| [Limits](docs/limits.html)           | what hydrargyri will not do, and the threat model for `:html`                           |

Agents: [`llms.txt`](llms.txt) is the link index, [`llms-full.txt`](llms-full.txt)
the whole thing in one file.

[MIT](https://github.com/stamat/hydrargyri/blob/main/LICENSE) © [Stamat](https://github.com/stamat)
