# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**How to use it:** land changes under `## [Unreleased]`, grouped under _Added_, _Changed_,
_Deprecated_, _Removed_, _Fixed_ or _Security_. Write entries for the person upgrading, not
for the person who wrote the code.

## [Unreleased]

## [1.0.0] - 2026-08-05

### Added

- **The library, finished from the 2024 prototype.** `hg(name, options)` defines a
  custom element whose observed attributes become typed camelCase properties reflected to
  the DOM, with `properties` for state that never touches an attribute, `handlers` for
  `on="event:name"` wiring, and `connected` / `disconnected` / `attributeChanged` lifecycle
  hooks. It is the default export — the docs write it `hg`, and the named export
  `hydrargyri` is the same function under its full name. `HgElement` is exported for
  elements that need methods of their own.
- **Typed binds.** `bind="path[:type[#attr]]"` paints into `textContent` (default),
  `innerHTML`, `.value`, or a named attribute; entries separate with `;` and paths may
  reach into objects (`user.name`). A malformed or typo'd entry warns and is skipped
  without taking the element's other binds with it.
- **Spec-safe lifecycle.** The prototype scanned children in the constructor, which the
  custom elements spec forbids and which found nothing during parse; scanning now happens
  on connect, deferred to `DOMContentLoaded` while the document is still parsing.
  Disconnecting unhooks every listener; reconnecting rescans.
- **Loud collisions.** An attribute or property whose name would shadow the hydrargyri API
  (`update`), a platform native (`title`), or a subclass method warns and is skipped at
  definition — instead of surfacing as a TypeError three calls from the cause.
- **Components talk the platform way, documented and pinned.** `on` hears bubbling
  custom events from descendants, a parent writes a child's observed attribute — no bus,
  no store; the composition docs page and two tests hold the guarantee.
- **`share(values)` — one handshake for a whole tag.** A static on every hydrargyri class:
  `Cls.share({ user: model })` hands each value to every instance, present and future,
  called once and never per change — with a `reactive()` model it is a standing broadcast.
  An instance assignment outranks share on that instance, forever, reconnects included.
  Property keys only: an attribute-backed key warns and is refused, because the attribute
  is the markup's per-instance state; an undeclared key warns and is skipped. No registry —
  the class reference is the capability. The object form of `properties` is the same
  handshake at define time — `properties: { user: model, draft: null }` declares the keys
  and shares the values in one place, and a runtime `share()` overrides it.
- **`on="event@window:name"` and `@document` — global events, element-owned.** `resize`,
  Escape, click-outside: the listener registers on the global the event actually fires on,
  the handler stays the element's, and disconnect unhooks it with every other listener
  hydrargyri added — the removal boilerplate that pattern usually leaks is gone. An unknown
  target (`click@body`) warns and is skipped without taking the entry's neighbours.
- **`reactive(model)` — the opt-in door out of `update(key)`.** Wrap a plain object or
  array once, assign it to any number of elements, and every mutation through the proxy
  repaints them all — no element references at the mutation site. The proxy is the model:
  the raw original notifies nobody, non-plain values (Maps, class instances) warn and come
  back unwrapped, and hydrargyri never wraps an object you did not ask wrapped. Disconnecting
  an element unsubscribes it; reconnecting catches it up.
- **Invoker Commands answered from `handlers`.** A button anywhere in the document
  says `commandfor="cart" command="--add-item"`, and the element replies from
  `handlers: { '--add-item': (e, el) => {} }` — keyed by the exact command string, no name
  transformation, in the same registry `on` names reach, assignable at runtime the same
  way. Custom commands must start with `--`, so command keys cannot collide with handler
  names. An unknown command warns only when a `--` key is declared; an element without one
  stays silent so `on="command:name"` can keep handling commands its own way.
- **`if` and `unless` binds — conditions without an expression.** `bind="items:if"`
  toggles the platform's `hidden` attribute on the value's truthiness, `unless` is the
  same toggle inverted — two sibling nodes make a full if/else with no JavaScript.
  `bind="items:if#isEmpty"` asks the named predicate in `conditions` instead, called as
  `(value, element)` on every paint of the key — the initial `null` included. The
  dependency is named in the bind itself, so nothing is tracked and nothing is evaluated.
  A missing condition warns and leaves the node as authored, and `conditions` is
  assignable at runtime like `handlers`.
- Jest suite covering the whole public surface.
- **A documentation site.** `docs/` builds to `_site/` with
  [poops-docs-theme](https://github.com/stamat/poops-docs-theme): a landing page and a
  reference under `/docs/` — getting started, API, `bind`, `on`, composition, examples,
  limits — whose samples run live and editable on the page. Plus a search index, `llms.txt` and
  `llms-full.txt` for agents, and a `pages.yml` workflow that deploys it on every push to
  `main`.
- **The [template](https://github.com/stamat/template) scaffolding.** `script/bootstrap`,
  `script/lint` and `script/changelog` join the four scripts already here; CI runs lint,
  test and build on Node 22 and 24; a tag triggers publishing over OIDC with no token
  stored anywhere. Issue forms, a pull request template, a code of conduct, Dependabot,
  `.editorconfig`, and `AGENTS.md` — symlinked as `CLAUDE.md` and
  `.github/copilot-instructions.md`, so one file serves every tool.
- **`parseBinds(raw)` exported** — the `bind` grammar's parser, for ecosystem
  packages that paint with the same grammar
  ([hydrargyri-each](https://github.com/stamat/hydrargyri-each)). The parser lives in
  hydrargyri so the grammar cannot fork; an element on hydrargyri alone never needs it.

### Changed

- **The demo page became the docs site.** `src/markup/` and the hand-rolled layout it used
  are gone, along with `dist/site.*` and the `index.html` that sat in the repository root.
  Every live preview loads `dist/hydrargyri-demos.min.js`, built from
  `src/scripts/demos.js`, which puts `hg` on the frame's `window`; each demo's element
  is defined by the ` ```js demo ` fence shown beside it, which is the code that runs.
- **`package-lock.json` is committed**, because `script/bootstrap` and CI both run
  `npm ci`, which needs one and will not write it.

### Removed

- **The `window` fallback.** A bind whose key matched nothing used to fall through to a
  global of the same name; it now warns instead — state lives on the element or nowhere.
