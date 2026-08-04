---
layout: default
---

# <sup>🜔</sup> {{ site.title }}
<p class="p1">{{ site.description }}<p>

Salis upgrades markup you already wrote into a reactive custom element:
`bind` paints state into the DOM, `on` wires events to named handlers, and
observed attributes become typed properties. No build step, no shadow DOM,
no expression language.

## Counter

Attributes are the state. `count` is observed, so setting `el.count` writes
the attribute, and editing the attribute in devtools repaints the `bind`.

```html
<demo-counter count="0">
  <button on="click:decrement">−</button>
  <output bind="count">0</output>
  <button on="click:increment">+</button>
</demo-counter>
```

```js
salis('demo-counter', {
  attributes: ['count'],
  handlers: {
    increment(e, el) { el.count += 1 },
    decrement(e, el) { el.count -= 1 }
  }
})
```

<demo-counter count="0">
  <button on="click:decrement">−</button>
  <output bind="count">0</output>
  <button on="click:increment">+</button>
</demo-counter>

## Greeter

DOM to state goes through a handler; state to DOM through a bind. The page
works before the script loads — the fallback text is simply replaced.

```html
<demo-greeter name="stranger">
  <label>Name <input on="input:rename"></label>
  <p>Hello, <span bind="name">stranger</span>!</p>
</demo-greeter>
```

```js
salis('demo-greeter', {
  attributes: ['name'],
  handlers: {
    rename(e, el) { el.name = e.target.value || null }
  }
})
```

<demo-greeter name="stranger">
  <label>Name <input on="input:rename"></label>
  <p>Hello, <span bind="name">stranger</span>!</p>
</demo-greeter>

## Clock

`properties` hold state that never touches an attribute, and the lifecycle
hooks own anything that needs starting and stopping.

```html
<demo-clock>
  <time bind="time">…</time>
</demo-clock>
```

```js
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
```

<demo-clock>
  <time bind="time">…</time>
</demo-clock>
