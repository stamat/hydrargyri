# Salis — agent notes

Reactive custom elements in the light DOM: `bind` and `on` carry names, never
code, and the page renders without the script. Read
[CONTRIBUTING.md](CONTRIBUTING.md) first — it defines what belongs in this
project and what a pull request needs.

Stack: vanilla ES modules, no framework and no TypeScript. Jest with jsdom,
built with [poops](https://github.com/stamat/poops). One runtime dependency,
[book-of-spells](https://github.com/stamat/book-of-spells).

## Commands

```bash
script/bootstrap # npm ci, from a fresh clone
script/server    # build + serve the docs with live reload, http://localhost:4040
script/build     # compiles dist/ and the docs site into _site/
script/test      # jest
script/lint      # eslint (the authority; CI runs it)
```

## Layout

- The library is one file, `src/scripts/salis.js`. Its test sits beside it as
  `src/scripts/salis.test.js`.
- `src/scripts/demos.js` is the bundle every live preview loads, compiled to
  `dist/salis-demos.min.js`. It puts salis on the frame's `window` and defines
  no elements — the demos define themselves.
- `docs/` is the site source, `_site/` its output. `dist/` is committed;
  `_site/` is not.
- `script/changelog` and `script/demos.js` are build tooling, not shipped.

## Documentation

Markdown in `docs/`, built by poops with
[poops-docs-theme](https://github.com/stamat/poops-docs-theme) into `_site/`,
deployed by [pages.yml](.github/workflows/pages.yml). The sidebar comes from the
`order` in each page's front matter; `llms.txt`, `llms-full.txt`, the search
index and `robots.txt` are generated.

Two layouts, and the split is not cosmetic: `docs/index.md` is the landing page
on the theme's `prose` layout, and the reference lives under `docs/docs/` on the
`docs` layout. The docs layout hardcodes its "docs" pill to `docs/`, so a
reference page anywhere else ships a 404 in its own header. The two layouts load
different bundles — `css/prose.min.css` + `js/prose.min.js` against
`css/docs.min.css` + `js/docs.min.js` — which is why `poops.json` builds both,
and why `docs/_palette.scss` exists rather than the colours sitting in one of
them.

Two things on a page are not prose:

- **A sample marked `<!-- demo -->` becomes a live preview**, wrapped by
  `script/demos.js` after the markup stage. A fence tagged ` ```js demo ` joins
  the group as a second tab. The fence stays the only source, so the code shown
  and the thing rendered cannot drift.
- **The ` ```js demo ` fence runs.** code-preview inlines that pane into the
  frame as a module, after `dist/salis-demos.min.js` has put `salis` on its
  `window` — so the fence is where the demo's element is defined, and every
  preview needs one. A sample whose tag nothing defines renders as inert markup
  with no warning; defining the same tag twice throws.

Rules:

- **Document in the same change as the code.** A new option or bind type lands
  in the docs page that covers it and in `docs/_llms/llms-intro.md` — that file
  is hand-written and does not regenerate. `README.md` holds no reference: it is
  the pitch, the comparison table and the non-goals, and it changes only when
  one of those does.
- **Edit the page that already covers it.** No new pages, summary files or
  migration notes nobody asked for.
- **Write for the author using it**: the markup they write, one example that
  runs, and the part that would otherwise surprise them.

## Principles

- **The markup is the author's.** Salis writes values into nodes that already
  exist; it never creates, reorders or diffs them. A change that generates
  markup is a change for a different library.
- **Names, never code.** Nothing in a `bind` or `on` attribute is evaluated.
  The moment one is, salis is a worse Alpine.
- **Test-driven.** The test is the spec; write it first. A failing test means
  the code is wrong — never weaken, skip, or delete a test to make it pass. If
  the test itself is wrong, say so and let review decide.
- **YAGNI.** Build only what the task needs — no speculative options,
  abstractions, or "for later" scaffolding.
- **Native / stdlib first.** In order: what's already in this repo → the web
  platform → the JS standard library → new code. A new dependency is a last
  resort and needs a reason.
- **Root cause over symptom.** Fix where all callers route through, not the one
  path the bug report names.
- **Delete dead code.** No commented-out blocks, no "for later" exports — git
  remembers.

## Boundaries

- **Always:** run `script/lint` and `script/test` before calling work done; pair
  every fix or feature with a test; add a changelog entry under
  `## [Unreleased]`.
- **Ask first:** changing `bind` or `on` syntax, the `salis()` options, or the
  `[salis]` attribute — that is the public API; adding a dependency.
- **Never:** edit `dist/` or `_site/` (generated); weaken, skip, or delete a
  test to make it pass; bump the version or publish — a tag does that.

## Before adding a feature

Run this checklist before writing any code; stop at the first "no".

1. **Does the platform already do it?** Custom elements, `attributeChangedCallback`,
   bubbling events, `setAttribute` — if the platform covers it, there is no
   feature.
2. **Search for prior art.** Catalyst, Stimulus, Alpine, Lit. What interface do
   they expose, and what does it cost them? Cite what you found — a URL per
   fact, no guesses.
3. **Does it fit the project?** CONTRIBUTING.md lists what salis refuses to
   become. Check against that list before building, not after.
4. **Still yes?** Build the smallest version that works.

## Non-obvious rules

- **`package.json` is still `private: true`.** Nothing publishes until that comes
  off, and [publish.yml](.github/workflows/publish.yml) will fail on the first
  `v*` tag if it is still there. Removing it is a release decision, not a
  cleanup.
- **`script/publish` writes the version itself**, in Node, rather than delegating
  to a `script/version`. It calls `script/changelog` and `script/build` if they
  exist, and pushing the tag is what triggers publishing.
- **`_defineAccessor` refuses colliding names.** An attribute or property whose
  camelCase name already answers on the element — salis API, a platform native,
  a subclass method — warns and is skipped. New instance fields on
  `SalisElement` go into the `RESERVED` set in the same change, or an element
  can silently dismantle its own machinery.
- **Attributes are the only copy of reflected state.** A reflected getter reads
  `getAttribute` every time; caching one would let devtools and salis disagree.
- **`attributeChangedCallback` fires on every `setAttribute`**, value changed or
  not. The `oldValue === newValue` guard is what stops a bind that writes its own
  element's attribute from looping.
