// The bundle every live preview loads: salis itself, put on the frame's window.
//
// The elements are not defined here. A preview's ```js demo fence *runs* —
// code-preview inlines that pane into the frame as a module — so the fence is
// the definition, which is what keeps the code shown and the thing rendered
// from being two things. Defining the same tags here as well would be a second
// `customElements.define` for each, which throws.
//
// A global rather than an import line in every fence: the fence is a sample of
// how salis is used, and `import salis from '../../dist/salis.min.mjs'` is a
// fact about this repository's layout — a different line on every page, and the
// wrong one for the reader copying it.
import salis from './salis.js'

window.salis = salis
