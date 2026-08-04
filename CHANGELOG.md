# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**How to use it:** land changes under `## [Unreleased]`, grouped under _Added_, _Changed_,
_Deprecated_, _Removed_, _Fixed_ or _Security_. Write entries for the person upgrading, not
for the person who wrote the code.

## [Unreleased]

### Added

- **The library, finished from the 2024 prototype.** `salis(name, options)` defines a
  custom element whose observed attributes become typed camelCase properties reflected to
  the DOM, with `properties` for state that never touches an attribute, `handlers` for
  `on="event:name"` wiring, and `connected` / `disconnected` / `attributeChanged` lifecycle
  hooks. `SalisElement` is exported for elements that need methods of their own.
- **Typed binds.** `bind="path[:type[#attr]]"` paints into `textContent` (default),
  `innerHTML`, `.value`, or a named attribute; entries separate with `;` and paths may
  reach into objects (`user.name`). A malformed or typo'd entry warns and is skipped
  without taking the element's other binds with it.
- **Spec-safe lifecycle.** The prototype scanned children in the constructor, which the
  custom elements spec forbids and which found nothing during parse; scanning now happens
  on connect, deferred to `DOMContentLoaded` while the document is still parsing.
  Disconnecting unhooks every listener; reconnecting rescans.
- Jest suite covering the whole public surface, and a demo site with three live elements.

### Removed

- **The `window` fallback.** A bind whose key matched nothing used to fall through to a
  global of the same name; it now warns instead — state lives on the element or nowhere.
