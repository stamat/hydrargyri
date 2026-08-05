// The bundle every live preview loads: hydrargyri itself, put on the frame's window.
//
// The elements are not defined here. A preview's ```js demo fence *runs* —
// code-preview inlines that pane into the frame as a module — so the fence is
// the definition, which is what keeps the code shown and the thing rendered
// from being two things. Defining the same tags here as well would be a second
// `customElements.define` for each, which throws.
//
// A global rather than an import line in every fence: the fence is a sample of
// how hydrargyri is used, and `import hg from '../../dist/hydrargyri.min.mjs'` is a
// fact about this repository's layout — a different line on every page, and the
// wrong one for the reader copying it.
// `hydrargyri-each` is the exception to the paragraph above: `<hg-each>` is a
// library element, not a demo's, so a fence would have nothing to define. It is
// imported for the side effect that defines it.
//
// Its `hydrargyri` peer is aliased to the source beside this file in poops.json,
// and that alias is load-bearing: npm installs the published package to satisfy
// the peer, so without it the bundle carries two copies of hydrargyri. Two copies
// share no `hgTags` and no reactive subscriber map — <hg-each> inside another
// hydrargyri element loses its binds to the outer one, and a reactive() model
// assigned to `items` never repaints.
import hg, { reactive } from './hydrargyri.js'
import 'hydrargyri-each'

window.hg = hg
window.reactive = reactive
