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
