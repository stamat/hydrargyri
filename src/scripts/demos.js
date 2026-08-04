// The elements the docs pages demonstrate, bundled into dist/salis-demos.min.js
// and loaded by every live preview — script/demos.js hands the same bundle to
// each `<code-preview>` frame, so a sample can use any of them without the page
// saying which.
//
// Every definition here is quoted verbatim in the page that shows it. Change one
// and the fence beside it goes stale; nothing in the build ties the two together.
import salis from './salis.js'

salis('demo-counter', {
  attributes: ['count'],
  handlers: {
    increment(e, el) { el.count += 1 },
    decrement(e, el) { el.count -= 1 }
  }
})

salis('demo-greeter', {
  attributes: ['name'],
  handlers: {
    rename(e, el) { el.name = e.target.value || null }
  }
})

salis('demo-clock', {
  properties: ['time'],
  connected(el) {
    el.time = new Date().toLocaleTimeString()
    el._timer = setInterval(() => { el.time = new Date().toLocaleTimeString() }, 1000)
  },
  disconnected(el) {
    clearInterval(el._timer)
  }
})

salis('demo-badge', {
  attributes: ['label', 'tone'],
  handlers: {
    relabel(e, el) { el.label = e.target.value || null },
    toggle(e, el) { el.tone = el.tone === 'warn' ? null : 'warn' }
  }
})

salis('demo-profile', {
  properties: ['user'],
  connected(el) {
    el.user = { name: 'Ada', role: 'engineer' }
  },
  handlers: {
    promote(e, el) {
      el.user.role = 'principal engineer'
      el.update('user')
    }
  }
})

salis('demo-item', {
  attributes: ['sku'],
  handlers: {
    pick(e, el) {
      el.dispatchEvent(new CustomEvent('item-picked', { bubbles: true, detail: { sku: el.sku } }))
    }
  }
})

salis('demo-cart', {
  properties: ['count'],
  connected(el) {
    el.count = 0
  },
  handlers: {
    refresh(e, el) { el.count += 1 }
  }
})
