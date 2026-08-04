// Turns marked code fences in the built pages into live, editable previews.
//
//     <!-- demo -->
//
//     ```html
//     <demo-counter count="0">…</demo-counter>
//     ```
//
// becomes a `<code-preview>` wrapping that same fence: the sample rendered in an
// iframe above the code that produced it, and the code editable.
//
// Every preview loads one bundle, `dist/salis-demos.min.js`, which is salis on
// the frame's `window` and nothing else. The elements come from the previews
// themselves — a `demo` fence is inlined into the frame as a module and runs, so
// the definition shown is the definition running. That is why the marker takes
// no arguments: there is only one thing a salis demo could ask for.
//
// Post-markup rather than in the markdown, which is the point of the marker. The
// fences stay fences in `docs/*.md`, so each one is still a block of real code to
// read, to copy, to highlight at build time, and to end up in `llms.txt` and the
// search index. Writing `<code-preview>` by hand in the markdown would mean
// escaping every sample into `&lt;demo-counter&gt;` and losing all four.
//
// Opting in per fence is deliberate: a docs page is full of html fences that are
// not demos — install snippets, markup being described rather than shown.
//
// The element is left *between* the marker and the code, so the pattern no longer
// matches and a second pass is a no-op. That matters in watch mode, where poops
// recompiles the page that changed and this runs over all of them again.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SITE = '_site'

// `<!-- demo -->`, with anything after the word passed through to the element,
// and the whitespace down to the fence under it.
const MARKER = /<!-- demo([^>]*)-->\s*/g

// One fence, as poops' markdown stage emits it. Sticky rather than searching:
// this is asked "does a fence start exactly here", never "where is the next one".
const FENCE = /<pre><code class="hljs language-[\w-]+[^"]*"[^>]*>[\s\S]*?<\/code><\/pre>/y

// A fence that said `demo` in its info string, and the whitespace above it — how
// a sample adds its JavaScript as a second tab. The lookahead keeps
// `language-demo` from reading as one.
const JOINED = /\s*<pre><code class="hljs language-[\w-]+[^"]*\sdemo(?=[\s"])[^"]*"[^>]*>[\s\S]*?<\/code><\/pre>/y

// The bundle with highlight.js inside it: the fences here are highlighted at
// build time, so the page carries no runtime highlighter for the editor to
// borrow. Only the pages that ended up with a preview pay for it.
const SCRIPT = 'js/code-preview-hljs.min.js'

// The frame is a bare document — it loads the demo bundle and nothing else, so
// without this it is black on white inside a dark page.
//
// `color-scheme` and the system colors rather than a copy of the docs palette:
// `Canvas`/`CanvasText` follow `color-scheme`, which follows the `[data-theme]`
// that `theme-attribute` is already mirroring in. Re-theming the site cannot
// leave the previews behind.
//
// It replaces the element's default head, which is only the body padding, so
// that comes back here.
const HEAD = [
  '<style>',
  ':root{color-scheme:light}',
  ':root[data-theme=dark]{color-scheme:dark}',
  'body{margin:0;padding:1rem;background:Canvas;color:CanvasText;',
  'font:1rem/1.5 system-ui,sans-serif}',
  'label{display:block;margin-block-end:0.35rem}',
  'button,input{font:inherit}',
  '</style>'
].join('')

/** Every .html file under _site, at any depth. */
function pages(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return pages(path)
    return path.endsWith('.html') ? [path] : []
  })
}

/**
 * What a page at this path has to prefix a site-root-relative url with. The same
 * job `relativePathPrefix` does in the markdown, done again here because this
 * stage is past the templating and only has the file path to go on.
 */
function prefixFor(path) {
  const depth = relative(SITE, path).split(sep).length - 1
  return '../'.repeat(depth)
}

/**
 * The attributes for one preview. Anything the marker carried is passed through
 * untouched, which is how a demo asks for a taller frame or a starting tab.
 */
function attributesFor(spec, prefix) {
  return [
    `js="${prefix}dist/salis-demos.min.js"`,
    // The docs theme's switcher writes [data-theme] on the page; this carries it
    // into the frame, so a demo in dark mode is demonstrated in dark mode.
    'theme-attribute="data-theme"',
    `head="${HEAD.replace(/"/g, '&quot;')}"`,
    spec.trim()
  ].filter(Boolean).join(' ')
}

/**
 * Wrap every marked group on one page.
 *
 * A scan rather than a `replace`, because a group is a marker plus a run of
 * fences whose length is not known until the run stops — which a single pattern
 * can express only by being greedy enough to swallow the snippet under it.
 *
 * @param {string} html The built page.
 * @param {string} prefix What this page prefixes a site-root-relative url with.
 * @returns {{ html: string, count: number }}
 */
function wrapDemos(html, prefix) {
  let out = ''
  let at = 0
  let count = 0
  let marker

  MARKER.lastIndex = 0
  while ((marker = MARKER.exec(html))) {
    FENCE.lastIndex = MARKER.lastIndex
    // A marker with no fence under it — or one whose fences this pass has
    // already wrapped, which is what makes a second pass a no-op.
    if (!FENCE.exec(html)) continue

    let end = FENCE.lastIndex
    for (;;) {
      JOINED.lastIndex = end
      if (!JOINED.exec(html)) break
      end = JOINED.lastIndex
    }

    out += html.slice(at, MARKER.lastIndex)
    out += `<code-preview ${attributesFor(marker[1], prefix)}>${html.slice(MARKER.lastIndex, end)}</code-preview>`
    at = end
    count += 1
    // Past the group, so a fence inside it can never be read as the start of the next.
    MARKER.lastIndex = end
  }

  return { html: out + html.slice(at), count }
}

let wrapped = 0
let touched = 0

for (const path of pages(SITE)) {
  const prefix = prefixFor(path)
  const { html, count } = wrapDemos(readFileSync(path, 'utf8'), prefix)
  if (!count) continue

  let after = html
  if (!after.includes(SCRIPT)) {
    after = after.replace('</body>', `<script src="${prefix}${SCRIPT}"></script></body>`)
  }

  writeFileSync(path, after)
  wrapped += count
  touched += 1
}

console.log(`demos: ${wrapped} previews across ${touched} pages`)
