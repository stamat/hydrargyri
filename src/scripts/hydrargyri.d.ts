// Hand-written declarations for the JS source next door. Kept by hand on
// purpose: the surface is eight names and moves rarely; a generator would need
// a toolchain the repo otherwise has no use for. Change the source, change this.

/** A handler from the `handlers` registry, wired by `on="event:name"` or an Invoker Command key. */
export type HgHandler = (event: Event, element: HgElement) => void

/** A predicate from `conditions`, run by `bind="key:if#name"` — truthiness decides. */
export type HgCondition = (value: unknown, element: HgElement) => unknown

/** A formatter from `formatters`, run by `bind="key|name[:arg…]"` — the return value is painted; `undefined` leaves the node alone. */
export type HgFormatter = (value: unknown, element: HgElement, ...args: unknown[]) => unknown

/** One parsed `bind` entry. */
export interface HgBindEntry {
  path: string[]
  type: 'text' | 'html' | 'value' | 'attr' | 'prop' | 'class' | 'if' | 'unless'
  attr: string | null
  format: { name: string; args: string[][] } | null
}

/** Options for `hg()` — `HgElement`'s statics plus the lifecycle hooks. */
export interface HgOptions {
  /** Observed attributes, each becoming a reactive camelCase property reflected to the DOM. */
  attributes?: string[]
  /** Reactive properties without an attribute — names, or name → class-wide default (define-time share). */
  properties?: string[] | Record<string, unknown>
  handlers?: Record<string, HgHandler>
  conditions?: Record<string, HgCondition>
  formatters?: Record<string, HgFormatter>
  /** Runs once the element is upgraded, scanned and painted. */
  connected?: (element: HgElement) => void
  /** Runs when the element leaves the DOM. */
  disconnected?: (element: HgElement) => void
  /** Runs on observed attribute changes after init, with parsed values. */
  attributeChanged?: (name: string, oldValue: unknown, newValue: unknown) => void
}

/** Base class behind every hydrargyri element. Extend it directly when the element needs methods of its own; otherwise `hg()` is shorter. */
export class HgElement extends HTMLElement {
  static attributes: string[]
  static properties: string[] | Record<string, unknown>
  static handlers: Record<string, HgHandler>
  static conditions: Record<string, HgCondition>
  static formatters: Record<string, HgFormatter>
  static readonly observedAttributes: string[]
  /** Hand a value to every instance of this element, present and future — the tag-wide form of `el.key = value`. Property keys only. */
  static share(values: Record<string, unknown>): void

  handlers: Record<string, HgHandler>
  conditions: Record<string, HgCondition>
  formatters: Record<string, HgFormatter>

  /** Repaint bound nodes — all of them, or only those bound to one key. */
  update(key?: string): void
  /** Re-collect binds and handlers from the current subtree and repaint. */
  rescan(): void

  /** Subclass hooks — override these, never the *Callback methods. */
  connected?(element: this): void
  disconnected?(element: this): void
  attributeChanged?(name: string, oldValue: unknown, newValue: unknown): void

  // Declared attributes and properties become accessors at construction, so
  // their names cannot be known here — the price of a runtime-defined surface.
  [key: string]: any
}

/**
 * Wrap a model in a deep proxy that repaints every hydrargyri element it is
 * assigned to on any mutation. The proxy is the model; wrapping the same
 * object again returns that same model. Anything but a plain object or array
 * warns and comes back unwrapped.
 */
export function reactive<T extends object>(obj: T): T

/** Parse a `bind` attribute — `path[:type[#attr]][|formatter[:arg…]][;more]`. Malformed entries warn and are skipped. */
export function parseBinds(raw: string): HgBindEntry[]

/** Define a custom element declaratively and return its class. An array is shorthand for `{ attributes }`. */
export default function hg(name: string, options?: HgOptions | string[]): typeof HgElement

/** The named form of the default export, so `import { hydrargyri }` resolves. */
export { hg as hydrargyri }
