# Contributing to Salis

Issues and pull requests are welcome. Taking part means keeping to the
[Code of Conduct](CODE_OF_CONDUCT.md).

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

`:html` binds are `innerHTML`, verbatim — sanitizing is out of scope, and
[the Limits page](https://stamat.github.io/salis/limits.html) says so where it
documents the type. The contract: bind values are the author's state, not user
input. `text` binds go through `textContent` and `attr` binds through
`setAttribute`, so payloads arriving there cannot become elements —
`salis.test.js` holds a test proving markup through a text bind stays text. A
PR touching `_render` keeps that test green.

## Getting set up

```bash
git clone https://github.com/stamat/salis.git
cd salis
script/bootstrap
```

```bash
script/server    # build + serve the docs with live reload, http://localhost:4040
script/build     # compiles dist/ and the docs site into _site/
script/test      # jest
script/lint      # eslint
```

The library is one file, `src/scripts/salis.js`, with its test beside it.
`docs/` is the site source and `_site/` its output; `dist/` is committed and
`_site/` is not. A live preview on a docs page runs `dist/salis-demos.min.js`,
built from `src/scripts/demos.js` — a sample using a tag that is not defined
there renders as inert markup and says nothing about it.

## Reporting a bug

[Open an issue](../../issues/new/choose) — the form asks for what you ran, what
you expected, the version and the environment. For anything about binding or
upgrade order, the markup and the JavaScript together, because either half
alone reproduces nothing.

## Pull requests

- **A test per change**, in `src/scripts/salis.test.js`. Test names are
  sentences stating the guarantee. A failing test means the code is wrong —
  never weaken or delete one to make it pass; if the test itself is wrong, say
  so in the PR and let review decide.
- **Docs in the same change.** A new option or bind type lands in the docs page
  that covers it, in the README, and in `docs/_llms/llms-intro.md`, which is
  hand-written and does not regenerate.
- **Progressive enhancement intact.** Every sample must read sensibly with the
  script blocked.
- **Run `script/lint`.** eslint is the authority, and CI runs it on Node 22 and
  24.
- **Add a changelog entry** under `## [Unreleased]` in
  [CHANGELOG.md](CHANGELOG.md) — that file explains the format.
- **Keep the diff about one thing.** A rename bundled with a fix is two reviews
  wearing one hat.
- `dist/` and `_site/` are generated — never edit either by hand.
- **Agent-written code is welcome — you still own it.** It meets the same bar
  as handwritten code: tests, lint, CI green. You understand every line well
  enough to answer review questions; "the agent wrote it" is not an answer.
  Point your agent at [AGENTS.md](AGENTS.md) before it starts.

Commit messages are freeform, write something that says what changed.

## How a release works

`script/publish [version]` bumps `package.json`, runs `script/changelog` to cut
`[Unreleased]` into a released entry, builds, commits, tags and pushes. Pushing
the tag triggers [publish.yml](.github/workflows/publish.yml), which publishes
to npm via trusted publishing — OIDC, no tokens stored anywhere. The changelog
entry becomes the body of the GitHub release verbatim.

Nothing publishes while `package.json` says `private: true`, which it still
does. Taking that off is the decision that makes salis a released package, and
it is not a cleanup task.
