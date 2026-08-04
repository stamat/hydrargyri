# Contributing

Salis is one idea kept small: state painted into markup the author already
wrote, through names — never code — in attributes. A change that grows that
idea is welcome; a change that grows the surface is probably for a different
library.

## What salis refuses to become

- **No expression language.** `bind` and `on` carry names and paths, never
  JavaScript. The moment an attribute is evaluated, salis is a worse Alpine —
  logic lives in handlers and methods, in JS files, where it can be tested.
- **No templating and no virtual DOM.** The markup is the author's. Salis
  writes values into existing nodes; it never creates, reorders, or diffs
  them.
- **No shadow DOM.** The light DOM is the point: the page's CSS, the page's
  semantics, the page working before the script arrives.
- **No two-way binding.** DOM to state goes through a handler the author
  wrote. A `value` bind that silently writes back is the kind of magic that
  pages one debugger at 3am.
- **No deep reactivity.** Assignment triggers a repaint; mutation inside an
  object needs `update(key)`. A Proxy watching every property is more
  machinery than this library is worth — that trade is deliberate and
  documented, not a bug to fix.
- **No dependencies** beyond [book-of-spells](https://github.com/stamat/book-of-spells).

## Threat model

`:html` binds are `innerHTML`, verbatim — sanitizing is out of scope, and the
README says so where it documents the type. The contract: bind values are the
author's state, not user input. `text` binds go through `textContent` and
`attr` binds through `setAttribute`, so payloads arriving there cannot become
elements — `salis.test.js` holds a test proving markup through a text bind
stays text. A PR touching `_render` keeps that test green.

## What a PR needs

- **A test per change**, in `src/scripts/salis.test.js`. Test names are
  sentences stating the guarantee. A failing test means the code is wrong —
  never weaken or delete one to make it pass; if the test itself is wrong,
  say so in the PR and let review decide.
- **Docs in the same change.** A new option or bind type lands in the README
  table and, when it changes what the demo shows, in `src/markup/index.md`.
- **Progressive enhancement intact.** Every demo must read sensibly with the
  script blocked.
- `dist/` is generated — never edit it by hand; `script/build` rebuilds it.

```bash
script/test     # jest — must be green
script/build    # rebuilds dist/ and the demo site
script/server   # eyeball the demo at http://localhost:4040
```
