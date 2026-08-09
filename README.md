# ☿ Hydrargyri [![npm version](https://img.shields.io/npm/v/hydrargyri)](https://www.npmjs.com/package/hydrargyri) [![ci](https://img.shields.io/github/actions/workflow/status/stamat/hydrargyri/ci.yml?branch=main&label=ci)](https://github.com/stamat/hydrargyri/actions/workflows/ci.yml) [![license mit](https://img.shields.io/badge/license-MIT-green)](https://github.com/stamat/hydrargyri/blob/main/LICENSE)

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
import hg from "hydrargyri";

hg("demo-counter", {
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

## What you get

- **Typed attributes, reflected.** `attributes: ["count"]` gives a camelCase
  property; `count="5"` reads back as `5`, a valueless attribute as `true`, and
  the attribute stays the only copy of the value.
- **`bind` paints where state lands.** `text`, `html`, `value`, `attr#name`,
  `prop#name`, `class#name`, `if` / `unless`, with paths reaching into objects.
- **`on` wires what fires.** `on="click:increment"`, the handler called as
  `(event, element)`; a handler keyed by a command string answers
  [Invoker Commands](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API)
  directly.
- **Formatters at paint.** `bind="price|money:currency"` shapes the value on its
  way into the node, its arguments resolved as property paths.
- **Named conditions.** `bind="items:if#isLow"` runs a predicate from a JS file,
  where it can be tested — the markup carries only its name.
- **Opt-in deep reactivity.** `reactive(model)` repaints on mutation, once per
  synchronous burst; nothing is wrapped unless you ask for it.
- **`share()` hands one model to every instance** of a tag, present and future.
- **The page renders without the script.** Binds paint over markup that already
  reads correctly, so a script that fails to load leaves the document as
  authored. Nothing is evaluated, so a strict Content Security Policy has
  nothing to object to.

[Catalyst](https://github.com/github/catalyst) is where this started — markup
first, custom elements, names in attributes; the shape was already right. What
it charges for that shape is a build step — decorators and TypeScript are the
path it is written for, even though a plain function call exists. Hydrargyri
is the same idea attempted with nothing but the platform underneath: plain ES
modules, plain classes, attributes a browser already parses. Whether that trade
is worth losing Catalyst's type safety is a taste question, and the table below
is the honest version of it.

Like sulphuris, the value here is personal first: this is the wrapper I wanted
to exist, and it transfers to whoever shares the taste for markup-first pages.
If you want templating, two-way binding, or an ecosystem, the table below says
where to go — those are fine tools and hydrargyri does not compete on their ground.

## Against the alternatives

The table is drawn on hydrargyri's axes, which is the caveat to read it with: a
row exists because this library has an opinion about it, and the rows it has no
answer for are the ones the others win.

|                                | hydrargyri                                                                   | [Catalyst](https://github.com/github/catalyst) | [Stimulus](https://stimulus.hotwired.dev)              | [Alpine](https://alpinejs.dev)                | [Lit](https://lit.dev)                        |
| ------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------ | --------------------------------------------- | --------------------------------------------- |
| **Size, gzipped**              | 3.7 kB                                                                       | 2.5 kB                                         | 11.0 kB                                                | 16.3 kB                                       | 5.9 kB                                        |
| **Build step**                 | no                                                                           | yes — TS decorators                            | no                                                     | no                                            | no, but expected                              |
| **Component boundary**         | custom element                                                               | custom element                                 | its own registry                                       | attribute scan                                | custom element                                |
| **Shadow DOM**                 | never                                                                        | opt-in                                         | n/a                                                    | n/a                                           | by default                                    |
| **Evaluates attributes**       | no                                                                           | no                                             | no                                                     | yes                                           | no                                            |
| **Declarative value binding**  | `bind`                                                                       | no — refs you repaint                          | no — refs you repaint                                  | `x-text`, `x-bind`                            | in the JS template                            |
| **Conditionals**               | named predicates                                                             | your DOM code                                  | your controller code                                   | `x-if`, evaluated                             | ternaries in JS                               |
| **Typed attributes**           | `attributes`, reflected                                                      | `@attr`                                        | the values API                                         | no                                            | `@property`                                   |
| **Formatters at paint**        | `formatters`                                                                 | no                                             | no                                                     | expressions                                   | directives                                    |
| **Invoker Commands**           | a handler key that is a `command`                                            | no                                             | no                                                     | no                                            | no                                            |
| **Deep reactivity**            | opt-in, `reactive()`                                                         | no                                             | no                                                     | yes, implicit                                 | no                                            |
| **Two-way binding**            | no                                                                           | no                                             | no                                                     | `x-model`                                     | no                                            |
| **Lists and templating**       | no — [hg-each](https://stamat.github.io/hydrargyri/docs/each.html) is its own package | no                                             | no                                                     | `x-for`                                       | yes                                           |
| **Renders without the script** | yes                                                                          | yes                                            | yes                                                    | mostly — `x-cloak`                            | no                                            |
| **Ecosystem**                  | none                                                                         | GitHub's                                       | large, especially Rails                                | large                                         | large                                         |
| **Pick it when**               | the markup exists first and must survive without the script                  | you already build with TypeScript              | you want the mature ecosystem, especially around Rails | you want logic inline and accept the CSP cost | you are building an app, not upgrading a page |

Sizes are each package's public entry bundled and minified as ESM through
esbuild, then gzipped — hydrargyri's carries book-of-spells, which ships inside
`dist/`. Every one of those numbers moves with a release; measure before
quoting.

Where hydrargyri loses is the bottom of the table, and it loses there on
purpose: no templating, no two-way binding, no ecosystem. That is the trade,
and [what hydrargyri does not do](#what-hydrargyri-does-not-do) spells it out
rather than burying it.

Stimulus earns the honest footnote: same religion, different church. The same
names-in-markup creed, the same CSP-cleanliness, near-identical event wiring
and typed attribute-backed values. The doctrine splits on exactly two points —
`bind` paints declaratively where Stimulus targets are refs you repaint by
hand, and the component boundary is the platform's custom element instead of a
runtime with a registry, which is also why hydrargyri is 3.7 kB gzipped where
Stimulus is 11kB. Past that split it reaches where the table above does not look:
outlets wiring one controller to another, action params and options,
`targetConnected`, a classes API, Turbo underneath the whole thing. Weigh the
two points against that reach, not the row count.

## Install

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

## The whole surface

<https://stamat.github.io/hydrargyri/> — every sample on those pages runs live and
editable. There is no second copy of the reference: this README is the pitch,
the site is the manual.

| Page                                                                     | What it covers                                                                                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| [Getting started](https://stamat.github.io/hydrargyri/docs/)             | the three parts of a hydrargyri element, in one screen                                                                                  |
| [API](https://stamat.github.io/hydrargyri/docs/api.html)                 | `hg()`, `HgElement`, typed attributes, `properties`, `formatters`, lifecycle, `update()`, `reactive()`, `share()`                       |
| [bind](https://stamat.github.io/hydrargyri/docs/bind.html)               | where state lands: `text`, `html`, `value`, `attr#name`, `prop#name`, `class#name`, `if` / `unless`, formatters, and paths into objects |
| [on](https://stamat.github.io/hydrargyri/docs/on.html)                   | what fires: event names, handler resolution, the `(event, element)` signature                                                           |
| [Composition](https://stamat.github.io/hydrargyri/docs/composition.html) | elements talking to each other — events up, attributes down, no bus                                                                     |
| [Examples](https://stamat.github.io/hydrargyri/docs/examples.html)       | whole pieces that run: a `<template>` stamped into an element, a todo list an ordinary `<form>` adds to                                 |
| [Limits](https://stamat.github.io/hydrargyri/docs/limits.html)           | what hydrargyri will not do, and the threat model for `:html`                                                                           |
| [hg-each](https://stamat.github.io/hydrargyri/docs/each.html)            | the list element in its own package — the rows region, `key`, and binds resolving into the item                                         |

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
