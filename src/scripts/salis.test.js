// Covers the whole public surface: the factory, the SalisElement base class,
// attribute↔property reflection, every bind type, handler wiring, nesting
// scope, lifecycle hooks, deferred init during parse, pre-upgrade property
// capture, and reactive models. Deliberately not covered: dynamically
// inserted bind/on nodes — binds are scanned at connect, and picking up later
// DOM is a documented non-goal for v1 (reconnecting the element rescans).
import { jest } from '@jest/globals'
import salis, { SalisElement, reactive } from './salis.js'

let n = 0
const tag = () => `x-t${++n}`

function mount(html) {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
  jest.restoreAllMocks()
})

test('the factory defines the element and returns a SalisElement subclass', () => {
  const name = tag()
  const Cls = salis(name, ['foo'])
  expect(customElements.get(name)).toBe(Cls)
  expect(Object.getPrototypeOf(Cls)).toBe(SalisElement)
})

test('an observed attribute becomes a typed property, and setting it writes the attribute back', () => {
  const name = tag()
  salis(name, ['count'])
  const root = mount(`<${name} count="5"></${name}>`)
  const el = root.firstElementChild
  expect(el.count).toBe(5)
  el.count = 12
  expect(el.getAttribute('count')).toBe('12')
  expect(el.count).toBe(12)
})

test('a dashed attribute is reachable as its camelCase property', () => {
  const name = tag()
  salis(name, ['user-name'])
  const root = mount(`<${name} user-name="ada"></${name}>`)
  const el = root.firstElementChild
  expect(el.userName).toBe('ada')
  el.userName = 'grace'
  expect(el.getAttribute('user-name')).toBe('grace')
})

test('a valueless attribute reads as true, false removes it, true puts it back empty', () => {
  const name = tag()
  salis(name, ['active'])
  const root = mount(`<${name} active></${name}>`)
  const el = root.firstElementChild
  expect(el.active).toBe(true)
  el.active = false
  expect(el.hasAttribute('active')).toBe(false)
  expect(el.active).toBe(null)
  el.active = true
  expect(el.getAttribute('active')).toBe('')
})

test('a bare bind paints textContent from the attribute and repaints on setAttribute', () => {
  const name = tag()
  salis(name, ['count'])
  const root = mount(`<${name} count="5"><span bind="count">stale</span></${name}>`)
  const el = root.firstElementChild
  const span = el.querySelector('span')
  expect(span.textContent).toBe('5')
  el.setAttribute('count', '9')
  expect(span.textContent).toBe('9')
})

test('markup arriving through a text bind stays text, it cannot become elements', () => {
  const name = tag()
  salis(name, { properties: ['payload'] })
  const root = mount(`<${name}><span bind="payload"></span></${name}>`)
  const el = root.firstElementChild
  el.payload = '<img src=x onerror="boom()">'
  expect(el.querySelector('img')).toBe(null)
  expect(el.querySelector('span').textContent).toContain('<img')
})

test('a value bind fills the input, an attr bind sets the named attribute, an html bind parses', () => {
  const name = tag()
  salis(name, { properties: ['query', 'url', 'body'] })
  const root = mount(
    `<${name}><input bind="query:value"><a bind="url:attr#href">go</a><div bind="body:html"></div></${name}>`
  )
  const el = root.firstElementChild
  el.query = 'salt'
  el.url = '/x'
  el.body = '<b>bold</b>'
  expect(el.querySelector('input').value).toBe('salt')
  expect(el.querySelector('a').getAttribute('href')).toBe('/x')
  expect(el.querySelector('div').querySelector('b')).not.toBe(null)
})

test('a false value removes a bound attribute, true sets it empty', () => {
  const name = tag()
  salis(name, { properties: ['busy'] })
  const root = mount(`<${name}><div bind="busy:attr#aria-busy" aria-busy="true"></div></${name}>`)
  const el = root.firstElementChild
  const div = el.querySelector('div')
  el.busy = false
  expect(div.hasAttribute('aria-busy')).toBe(false)
  el.busy = true
  expect(div.getAttribute('aria-busy')).toBe('')
})

test('one bind attribute carries several semicolon-separated entries', () => {
  const name = tag()
  salis(name, ['count'])
  const root = mount(`<${name} count="3"><i bind="count:text;count:attr#data-n"></i></${name}>`)
  const i = root.querySelector('i')
  expect(i.textContent).toBe('3')
  expect(i.getAttribute('data-n')).toBe('3')
})

test('several elements bound to one key all repaint on a single set', () => {
  const name = tag()
  salis(name, { properties: ['msg'] })
  const root = mount(`<${name}><b bind="msg"></b><i bind="msg"></i></${name}>`)
  const el = root.firstElementChild
  el.msg = 'hi'
  expect(el.querySelector('b').textContent).toBe('hi')
  expect(el.querySelector('i').textContent).toBe('hi')
})

test('a dotted path renders the nested value, and a missing branch leaves the node alone', () => {
  const name = tag()
  salis(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.name">placeholder</span></${name}>`)
  const el = root.firstElementChild
  expect(el.querySelector('span').textContent).toBe('placeholder')
  el.user = { name: 'ada' }
  expect(el.querySelector('span').textContent).toBe('ada')
})

test('mutation inside an object is invisible until update(key) repaints it', () => {
  const name = tag()
  salis(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.name"></span></${name}>`)
  const el = root.firstElementChild
  el.user = { name: 'ada' }
  el.user.name = 'grace'
  expect(el.querySelector('span').textContent).toBe('ada')
  el.update('user')
  expect(el.querySelector('span').textContent).toBe('grace')
})

test('a property never touches an attribute, only its binds', () => {
  const name = tag()
  salis(name, { properties: ['secret'] })
  const root = mount(`<${name}><span bind="secret"></span></${name}>`)
  const el = root.firstElementChild
  el.secret = 'hush'
  expect(el.hasAttribute('secret')).toBe(false)
  expect(el.querySelector('span').textContent).toBe('hush')
})

test('a declared handler fires with the event and the element', () => {
  const name = tag()
  const seen = []
  salis(name, {
    handlers: { poke: (e, el) => seen.push([e.type, el.tagName]) }
  })
  const root = mount(`<${name}><button on="click:poke">go</button></${name}>`)
  root.querySelector('button').click()
  expect(seen).toEqual([['click', name.toUpperCase()]])
})

test('a subclass method outranks the registry, and only one of the two runs', () => {
  const name = tag()
  const calls = []
  class El extends SalisElement {
    static handlers = { poke: () => calls.push('registry') }
    poke() { calls.push('method') }
  }
  customElements.define(name, El)
  mount(`<${name} on="click:poke"></${name}>`).firstElementChild.click()
  expect(calls).toEqual(['method'])
})

test('an unknown handler warns instead of throwing', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  salis(name, [])
  const root = mount(`<${name}><button on="click:nope"></button></${name}>`)
  expect(() => root.querySelector('button').click()).not.toThrow()
  expect(warn).toHaveBeenCalled()
})

test('one on attribute wires several semicolon-separated events', () => {
  const name = tag()
  const seen = []
  salis(name, { handlers: { note: (e) => seen.push(e.type) } })
  const root = mount(`<${name}><input on="focus:note;input:note"></${name}>`)
  const input = root.querySelector('input')
  input.dispatchEvent(new Event('focus'))
  input.dispatchEvent(new Event('input'))
  expect(seen).toEqual(['focus', 'input'])
})

test('nested salis elements of different tags keep their binds and handlers to themselves', () => {
  const outer = tag()
  const inner = tag()
  salis(outer, { properties: ['msg'] })
  salis(inner, { properties: ['msg'] })
  const root = mount(
    `<${outer}><b bind="msg"></b><${inner}><i bind="msg"></i></${inner}></${outer}>`
  )
  const outerEl = root.firstElementChild
  const innerEl = outerEl.querySelector(inner)
  outerEl.msg = 'out'
  expect(outerEl.querySelector('b').textContent).toBe('out')
  expect(innerEl.querySelector('i').textContent).toBe('')
  innerEl.msg = 'in'
  expect(innerEl.querySelector('i').textContent).toBe('in')
})

test('same-tag nesting scopes binds to the nearest instance', () => {
  const name = tag()
  salis(name, ['label'])
  const root = mount(
    `<${name} label="a"><b bind="label"></b><${name} label="b"><i bind="label"></i></${name}></${name}>`
  )
  expect(root.querySelector('b').textContent).toBe('a')
  expect(root.querySelector('i').textContent).toBe('b')
})

test('a bind on the salis element itself works, scoped to itself', () => {
  const name = tag()
  salis(name, ['state'])
  const root = mount(`<${name} state="on" bind="state:attr#data-state"></${name}>`)
  expect(root.firstElementChild.getAttribute('data-state')).toBe('on')
})

test('a typo in a bind key warns once at scan and never throws on update', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  salis(name, ['count'])
  const root = mount(`<${name} count="1"><span bind="conut"></span></${name}>`)
  expect(warn).toHaveBeenCalled()
  expect(() => root.firstElementChild.update()).not.toThrow()
})

test('a malformed bind entry is skipped while its valid neighbours still paint', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  salis(name, ['count'])
  const root = mount(`<${name} count="2"><span bind="count:attr;count"></span></${name}>`)
  expect(warn).toHaveBeenCalled()
  expect(root.querySelector('span').textContent).toBe('2')
})

test('disconnecting unhooks handlers, reconnecting rescans and repaints', () => {
  const name = tag()
  const seen = []
  salis(name, { handlers: { poke: () => seen.push('hit') } })
  const root = mount(`<${name}><button on="click:poke"></button></${name}>`)
  const el = root.firstElementChild
  const button = el.querySelector('button')
  el.remove()
  button.click()
  expect(seen).toEqual([])
  root.appendChild(el)
  button.click()
  expect(seen).toEqual(['hit'])
})

test('the connected hook runs after binds are painted, disconnected on removal', () => {
  const name = tag()
  const seen = []
  salis(name, {
    attributes: ['count'],
    connected: (el) => seen.push(['connected', el.querySelector('span').textContent]),
    disconnected: () => seen.push(['disconnected'])
  })
  const root = mount(`<${name} count="7"><span bind="count"></span></${name}>`)
  root.firstElementChild.remove()
  expect(seen).toEqual([['connected', '7'], ['disconnected']])
})

test('attributeChanged stays silent for markup-parsed values and reports parsed primitives after', () => {
  const name = tag()
  const seen = []
  salis(name, {
    attributes: ['count'],
    attributeChanged: (attr, oldValue, newValue) => seen.push([attr, oldValue, newValue])
  })
  const root = mount(`<${name} count="1"></${name}>`)
  expect(seen).toEqual([])
  root.firstElementChild.count = 2
  expect(seen).toEqual([['count', 1, 2]])
})

test('the element wears a salis attribute only once initialized, so unbound markup can be styled', () => {
  const name = tag()
  salis(name, [])
  const el = document.createElement(name)
  expect(el.hasAttribute('salis')).toBe(false)
  document.body.appendChild(el)
  expect(el.hasAttribute('salis')).toBe(true)
})

test('while the document is parsing, init waits for DOMContentLoaded to see all children', () => {
  const name = tag()
  salis(name, ['count'])
  Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true })
  const root = mount(`<${name} count="4"><span bind="count">stale</span></${name}>`)
  expect(root.querySelector('span').textContent).toBe('stale')
  delete document.readyState
  document.dispatchEvent(new Event('DOMContentLoaded'))
  expect(root.querySelector('span').textContent).toBe('4')
})

test('a property set before the element upgrades replays through the accessor', () => {
  const name = tag()
  const el = document.createElement(name)
  el.count = 5
  document.body.appendChild(el)
  salis(name, ['count'])
  expect(el.getAttribute('count')).toBe('5')
  expect(el.count).toBe(5)
})

test('a name colliding with the salis API or a native warns and is skipped, the element survives', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  salis(name, ['update', 'title', 'count'])
  const root = mount(`<${name} count="1"><span bind="count"></span></${name}>`)
  const el = root.firstElementChild
  expect(warn).toHaveBeenCalledTimes(2)
  expect(typeof el.update).toBe('function')
  expect(el.count).toBe(1)
  expect(el.querySelector('span').textContent).toBe('1')
})

test('data-bind and data-on work where the bare attributes would offend a validator', () => {
  const name = tag()
  const seen = []
  salis(name, {
    attributes: ['count'],
    handlers: { poke: () => seen.push('hit') }
  })
  const root = mount(
    `<${name} count="3"><span data-bind="count"></span><button data-on="click:poke"></button></${name}>`
  )
  expect(root.querySelector('span').textContent).toBe('3')
  root.querySelector('button').click()
  expect(seen).toEqual(['hit'])
})

test('null removes an attr-bound attribute and empties an html bind', () => {
  const name = tag()
  salis(name, { properties: ['state', 'body'] })
  const root = mount(`<${name}><i bind="state:attr#data-state"></i><div bind="body:html"></div></${name}>`)
  const el = root.firstElementChild
  el.state = 'on'
  el.body = '<b>x</b>'
  el.state = null
  el.body = null
  expect(el.querySelector('i').hasAttribute('data-state')).toBe(false)
  expect(el.querySelector('div').innerHTML).toBe('')
})

test('a bubbling custom event from a child element reaches the parent salis handler', () => {
  const parent = tag()
  const child = tag()
  const seen = []
  salis(child, {
    handlers: {
      pick: (e, el) => el.dispatchEvent(new CustomEvent('picked', { bubbles: true, detail: { sku: 7 } }))
    }
  })
  salis(parent, {
    handlers: { heard: (e) => seen.push(e.detail.sku) }
  })
  const root = mount(
    `<${parent} on="picked:heard"><${child}><button on="click:pick"></button></${child}></${parent}>`
  )
  root.querySelector('button').click()
  expect(seen).toEqual([7])
})

test('a parent writing a child observed attribute repaints the child on its own', () => {
  const parent = tag()
  const child = tag()
  salis(parent, [])
  salis(child, ['sku'])
  const root = mount(
    `<${parent}><${child} sku="7"><span bind="sku"></span></${child}></${parent}>`
  )
  const childEl = root.querySelector(child)
  childEl.sku = 9
  expect(childEl.getAttribute('sku')).toBe('9')
  expect(childEl.querySelector('span').textContent).toBe('9')
})

// jsdom has no CommandEvent yet, so command events are simulated as plain
// events wearing a `command` property — the router only reads that field.
function commandEvent(command) {
  return Object.assign(new Event('command'), { command })
}

test('a command routes to the action wearing its exact name, with the event and the element', () => {
  const name = tag()
  const seen = []
  salis(name, {
    attributes: ['count'],
    actions: {
      '--add-item': (e, el) => seen.push([e.command, el.tagName])
    }
  })
  const root = mount(`<${name} count="0"></${name}>`)
  root.firstElementChild.dispatchEvent(commandEvent('--add-item'))
  expect(seen).toEqual([['--add-item', name.toUpperCase()]])
})

test('an unknown command warns when actions are declared, and stays silent when none are', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const quiet = tag()
  const loud = tag()
  salis(quiet, [])
  salis(loud, { actions: { '--known': () => {} } })
  const root = mount(`<${quiet}></${quiet}><${loud}></${loud}>`)
  root.querySelector(quiet).dispatchEvent(commandEvent('--whatever'))
  expect(warn).not.toHaveBeenCalled()
  root.querySelector(loud).dispatchEvent(commandEvent('--typo'))
  expect(warn).toHaveBeenCalledTimes(1)
})

test('an action assigned at runtime routes without any re-wiring', () => {
  const name = tag()
  const seen = []
  salis(name, [])
  const root = mount(`<${name}></${name}>`)
  const el = root.firstElementChild
  el.actions['--late'] = (e, el) => seen.push(el.tagName)
  el.dispatchEvent(commandEvent('--late'))
  expect(seen).toEqual([name.toUpperCase()])
})

test('a reactive model repaints every element it is assigned to, no update() in sight', () => {
  const a = tag()
  const b = tag()
  salis(a, { properties: ['user'] })
  salis(b, { properties: ['user'] })
  const root = mount(`<${a}><span bind="user.name"></span></${a}><${b}><i bind="user.name"></i></${b}>`)
  const user = reactive({ name: 'ada' })
  root.querySelector(a).user = user
  root.querySelector(b).user = user
  user.name = 'grace'
  expect(root.querySelector('span').textContent).toBe('grace')
  expect(root.querySelector('i').textContent).toBe('grace')
})

test('mutation deep inside a reactive model repaints through the path bind', () => {
  const name = tag()
  salis(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.prefs.theme"></span></${name}>`)
  const el = root.firstElementChild
  el.user = reactive({ prefs: { theme: 'dark' } })
  expect(el.querySelector('span').textContent).toBe('dark')
  el.user.prefs.theme = 'light'
  expect(el.querySelector('span').textContent).toBe('light')
})

test('mutating the raw original does nothing — the proxy is the contract', () => {
  const name = tag()
  salis(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.name"></span></${name}>`)
  const el = root.firstElementChild
  const raw = { name: 'ada' }
  const user = reactive(raw)
  el.user = user
  raw.name = 'grace'
  expect(el.querySelector('span').textContent).toBe('ada')
  user.name = 'ida'
  expect(el.querySelector('span').textContent).toBe('ida')
})

test('a disconnected element stops repainting, reconnecting catches it up', () => {
  const name = tag()
  salis(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.name"></span></${name}>`)
  const el = root.firstElementChild
  const user = reactive({ name: 'ada' })
  el.user = user
  el.remove()
  user.name = 'grace'
  expect(el.querySelector('span').textContent).toBe('ada')
  root.appendChild(el)
  expect(el.querySelector('span').textContent).toBe('grace')
  user.name = 'ida'
  expect(el.querySelector('span').textContent).toBe('ida')
})

test('a model assigned before upgrade still subscribes once the element initializes', () => {
  const name = tag()
  const el = document.createElement(name)
  const user = reactive({ name: 'ada' })
  el.user = user
  el.innerHTML = '<span bind="user.name"></span>'
  document.body.appendChild(el)
  salis(name, { properties: ['user'] })
  expect(el.querySelector('span').textContent).toBe('ada')
  user.name = 'grace'
  expect(el.querySelector('span').textContent).toBe('grace')
})

test('reassigning a property unsubscribes the old model', () => {
  const name = tag()
  salis(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.name"></span></${name}>`)
  const el = root.firstElementChild
  const old = reactive({ name: 'ada' })
  el.user = old
  el.user = reactive({ name: 'grace' })
  const update = jest.spyOn(el, 'update')
  old.name = 'ghost'
  expect(update).not.toHaveBeenCalled()
})

test('an array push inside a reactive model repaints its binds', () => {
  const name = tag()
  salis(name, { properties: ['cart'] })
  const root = mount(`<${name}><span bind="cart.length"></span></${name}>`)
  const el = root.firstElementChild
  const cart = reactive([])
  el.cart = cart
  expect(el.querySelector('span').textContent).toBe('0')
  cart.push('salt')
  expect(el.querySelector('span').textContent).toBe('1')
})

test('reactive is idempotent, and a non-plain value warns and comes back as given', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const user = reactive({ name: 'ada' })
  expect(reactive(user)).toBe(user)
  expect(warn).not.toHaveBeenCalled()
  const map = new Map()
  expect(reactive(map)).toBe(map)
  expect(reactive(5)).toBe(5)
  expect(reactive(null)).toBe(null)
  expect(warn).toHaveBeenCalledTimes(3)
})
