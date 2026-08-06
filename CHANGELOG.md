# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**How to use it:** land changes under `## [Unreleased]`, grouped under _Added_, _Changed_,
_Deprecated_, _Removed_, _Fixed_ or _Security_. Write entries for the person upgrading, not
for the person who wrote the code.

## [Unreleased]

### Added

- **A todo list on the _Examples_ page.** The reference had `<hg-each>` painting an
  array somebody else assigned; this is the loop closed — an ordinary `<form>` adds
  a row, a checkbox writes through the row's `hgItem`, a button splices by `hg-row`,
  and a counter outside the list binds the same `reactive()` array. It names both
  trades it makes: no `key`, so rows are re-cloned rather than kept, and no
  persistence, so a reload is the markup's own row again.

### Fixed

- **A handler named after a platform method no longer runs the platform's code.**
  Name resolution looked at every method the element had, inherited ones included, so
  `on="click:remove"` called `Element.remove()` and the click detached the element —
  silently, with `handlers.remove` never reached. Resolution now stops at authored
  methods (the subclass and the instance, never at or past `HgElement`): a registry
  entry by a platform name runs, and a platform name with no entry warns instead of
  executing DOM code nobody wrote as a handler.

- **A `prop` bind on the element's own tag writing its own reactive key is refused at
  scan.** `<x-list bind="items:prop#items">` painted `items` into its own setter, and
  the setter repainted — a feedback loop that hit the call-stack limit on the first
  paint and took the element down with no hint of where. It now warns, names the loop,
  and is skipped; the fix on the page is assigning the property from a handler.

## [1.1.0] - 2026-08-05

### Added

- **A `class#name` bind — `bind="active:class#is-active"`.** Toggles one named class on
  the value's truthiness and writes nothing else. Reaching a class from markup used to
  mean `attr#class`, which is a `setAttribute` over the whole list: it removed the
  classes the author wrote, from the first paint, silently, with no warning to mark the
  spot. That left a page whose CSS you do not own out of reach, since a third-party or
  legacy stylesheet ships `.is-active` hooks rather than `[data-active]` ones. The rest
  of the `class` attribute is now untouched, so entries compose —
  `bind="alive:class#is-alive;busy:class#is-busy"` is two independent switches on one
  node. It is **not** a merge and will not become one: diffing a computed class list
  means remembering what was applied last paint, which goes stale against any other
  writer and is thrown away by a rescan. A formatter shapes the value first, as it does
  for `attr` — `count:class#low|isLow`; `null` and `false` take the class off; a `class`
  with no `#name` warns and is skipped, exactly as `attr` and `prop` do. For a value
  with several states, `attr#data-*` and one selector still beat N toggles.

- **A `prop#name` bind — `bind="quarters:prop#series"`.** Assigns the value to the named
  property, `el.name = value`, and it is the only type that can carry an array or an object
  to another element: an attribute holds a string, so anything else bound through `attr#`
  arrives as `[object Object]`. That left every custom element taking structured state —
  a chart's series, a combobox's options, a nested list's items — reachable only from
  JavaScript, however well the markup already knew the value. `value` was already a
  property write hardcoded to one name; this is its general form. `null` writes `null`,
  because a property has no removed state, and `undefined` still paints nothing. The
  property need not be declared and nothing is coerced, so `prop#innerHTML` is `:html`
  under another name and the same threat model applies. A `prop` with no `#name` warns
  and is skipped, exactly as `attr` does.

- **Formatters — `bind="price|money:currency"`.** A named function from the new
  `formatters` registry shapes a value on its way into the node, called as
  `(value, element, ...args)` — the answer to one key needing to be raw in an input
  and formatted in a sentence, which used to mean two properties and a sync
  obligation at every write site. Arguments are property paths resolved on the
  element, never literals, and naming one registers the bind under that key too —
  change `currency` and the price repaints, still with nothing tracked and nothing
  evaluated. One formatter per entry, no chaining; a missing name warns and paints
  the raw value; `if` and `unless` keep taking conditions. `parseBinds` entries
  grow a `format` field, `null` when there is no formatter.

- **An `hg-each` docs page.** List rendering had one sentence in _Limits_ and a link to
  another repository; the page now carries the shape, the `items` contract, how binds
  resolve into an item, and the handler and condition fall-through to the closest hydrargyri
  ancestor. Its samples run live: `hydrargyri-each` reached npm, so the docs bundle
  loads it beside hydrargyri and the page carries two editable previews — the shape,
  and a roster whose rows dismiss themselves through the owning element's
  handlers.

- **A warning in _`on`_ that the platform's own methods win a name.** A handler is
  looked up as a method before it is looked up in `handlers`, and an element already
  answers to `remove`, `focus`, `blur` and `click` — so `on="click:remove"` deletes
  the node it fired from and never reaches the `handlers` entry of that name, with
  nothing warning, because a method was found. Behaviour is unchanged; it was
  undocumented, and the `hg-each` page's own row-removal sample was written against
  it.

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
