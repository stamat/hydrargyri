# <sup>☿</sup> Hydrargyri

> Reactive web components in the light DOM — declarative binds and handlers on markup you already wrote.

Every reactive framework starts the same way: move your markup into our world.
Templates in JS, decorators that need a build step, expressions interpreted out
of attributes. The page you already had — the one that renders without any of
it — becomes the framework's output instead of your document.

Hydrargyri goes the other way. You keep the HTML. A custom element wraps the part
that changes, `bind` says where state lands, `on` says what fires, and the
script never loading leaves the page exactly as written:

```html
<demo-counter count="0">
  <button on="click:decrement" aria-label="Decrement">−</button>
  <output bind="count">0</output>
  <button on="click:increment" aria-label="Increment">+</button>
</demo-counter>
```

```js
import hydrargyri from "hydrargyri";

hydrargyri("demo-counter", {
  attributes: ["count"],
  handlers: {
    increment(e, el) {
      el.count += 1;
    },
    decrement(e, el) {
      el.count -= 1;
    },
  },
});
```

No build step, no shadow DOM, no expression language — `bind` and `on` hold
names, never code. Quicksilver, in the alchemical sense: the volatile principle,
the one that moves while the body stays put. Your markup holds still; the values
are what run through it. It sits on
[book-of-spells](https://github.com/stamat/book-of-spells), same shelf as
[sulphuris](https://github.com/stamat/sulphuris) 🜍.

Like sulphuris, the value here is personal first: this is the wrapper I wanted
to exist, and it transfers to whoever shares the taste for markup-first pages.
If you want templating, two-way binding, or an ecosystem, the table below says
where to go — those are fine tools and hydrargyri does not compete on their ground.

## Against the alternatives

|                                                | Keeps your markup    | Custom elements      | Build step          | Logic in markup                    | Conditionals                  | Pick it when                                                |
| ---------------------------------------------- | -------------------- | -------------------- | ------------------- | ---------------------------------- | ----------------------------- | ----------------------------------------------------------- |
| [Catalyst](https://github.com/github/catalyst) | yes                  | yes                  | yes — TS decorators | no                                 | no — you write DOM code       | you already build with TypeScript                           |
| [Stimulus](https://stimulus.hotwired.dev)      | yes                  | no — its own runtime | no                  | no                                 | no — controller code toggles  | you want the mature ecosystem, especially around Rails      |
| [Alpine](https://alpinejs.dev)                 | yes                  | no                   | no                  | yes — JS expressions in attributes | yes — `x-if`, evaluated       | you want logic inline and accept the CSP cost               |
| [Lit](https://lit.dev)                         | no — templates in JS | yes                  | no, but expected    | no                                 | yes — ternaries in JS templates | you are building an app, not upgrading a page               |
| hydrargyri                                          | yes                  | yes                  | no                  | no                                 | named predicates, never eval  | the markup exists first and must survive without the script |

Hydrargyri loses on features to every row above: no templating, no two-way binding,
no plugin ecosystem. That is the trade, and [what hydrargyri does not
do](#what-hydrargyri-does-not-do) spells it out rather than burying it.

Stimulus earns the honest footnote: same religion, different church. The same
names-in-markup creed, the same CSP-cleanliness, near-identical event wiring
and typed attribute-backed values. The doctrine splits on exactly two points —
`bind` paints declaratively where Stimulus targets are refs you repaint by
hand, and the component boundary is the platform's custom element instead of a
runtime with a registry, which is also why hydrargyri is 3 kB where Stimulus is 12.
If neither point matters to your project, go to their church; it is better run
in every other respect.

## Install

Not on npm yet — the commands below describe the shape of the release, not a
package you can pull today.

```bash
npm install hydrargyri
```

```js
import hydrargyri, { HgElement, reactive } from "hydrargyri";
```

Or straight from a CDN as a module, no install:

```html
<script type="module">
  import hydrargyri from "https://cdn.jsdelivr.net/npm/hydrargyri/dist/hydrargyri.mjs";
</script>
```

## The whole surface

<https://stamat.github.io/hydrargyri/> — every sample on those pages runs live and
editable. There is no second copy of the reference: this README is the pitch,
the site is the manual.

| Page                                                        | What it covers                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Getting started](https://stamat.github.io/hydrargyri/docs/)     | the three parts of a hydrargyri element, in one screen                                                  |
| [API](https://stamat.github.io/hydrargyri/docs/api.html)         | `hydrargyri()`, `HgElement`, typed attributes, `properties`, lifecycle, `update()`, `reactive()`, `share()` |
| [bind](https://stamat.github.io/hydrargyri/docs/bind.html)       | where state lands: `text`, `html`, `value`, `attr#name`, `if` / `unless`, and paths into objects   |
| [on](https://stamat.github.io/hydrargyri/docs/on.html)           | what fires: event names, handler resolution, the `(event, element)` signature                      |
| [Composition](https://stamat.github.io/hydrargyri/docs/composition.html) | elements talking to each other — events up, attributes down, no bus                        |
| [Limits](https://stamat.github.io/hydrargyri/docs/limits.html)   | what hydrargyri will not do, and the threat model for `:html`                                           |

Agents: [`llms.txt`](https://stamat.github.io/hydrargyri/llms.txt) is the link index,
[`llms-full.txt`](https://stamat.github.io/hydrargyri/llms-full.txt) the whole thing
in one file.

## What hydrargyri does not do

Each of these is a decision, not a gap waiting for a pull request;
[Limits](https://stamat.github.io/hydrargyri/docs/limits.html) carries the reasoning
for each.

- **Implicit deep reactivity.** Setters notice assignment, not mutation —
  `update(key)` repaints after mutating a plain object, and `reactive(model)` is
  the opt-in proxy that needs no such call. It only opens by name: hydrargyri never
  wraps an object you did not ask wrapped, and will not grow dependency
  tracking, computed values or effects.
- **Two-way binding.** DOM to state goes through a handler you wrote —
  `on="input:rename"` — never behind your back.
- **Late DOM.** Binds and handlers are scanned when the element connects. A
  `bind` node inserted afterwards is not seen; re-connecting the element
  rescans everything.
- **Sanitizing.** `:html` is `innerHTML`, verbatim. Bind your own state to it,
  never user input — `text` and `attr` binds are inert by construction, so
  markup arriving through them stays text. There is a test proving it.
- **Templating, a virtual DOM, a router, a store.** Hydrargyri writes values into
  nodes that already exist; it never creates, reorders or diffs them. A page
  built out of data wants one of the tools in the table above, and that is not
  a defeat. The one exception lives outside the house:
  [hydrargyri-each](https://github.com/stamat/hydrargyri-each) renders lists from an
  author-written `<template>`, same grammar, its own package — so this refusal
  stands.

## Development

```bash
script/bootstrap # npm ci, from a fresh clone
script/server    # build + serve the docs with live reload, http://localhost:4040
script/build     # compile dist/ and the docs site into _site/
script/test      # jest
script/lint      # eslint
```

[CONTRIBUTING.md](CONTRIBUTING.md) says what belongs here and what a pull
request needs; [AGENTS.md](AGENTS.md) is the same for a coding agent.

## License

[MIT](LICENSE) © [Stamat](https://github.com/stamat)
