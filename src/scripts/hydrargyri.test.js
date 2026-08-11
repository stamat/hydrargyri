// Covers the whole public surface: the factory, the HgElement base class,
// attribute↔property reflection, every bind type, formatters, handler wiring,
// nesting scope, lifecycle hooks, deferred init during parse, pre-upgrade
// property capture, reactive models, rescan(), and markup stamped from a
// template before define. Deliberately not covered: automatic pickup of
// dynamically inserted bind/on nodes — watching the subtree is a documented
// non-goal; rescan() and reconnecting are the manual doors, covered here.
import { jest } from '@jest/globals'
import hg, { HgElement, reactive, parseBinds, hydrargyri } from './hydrargyri.js'

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

test('the factory defines the element and returns a HgElement subclass', () => {
  const name = tag()
  const Cls = hg(name, ['foo'])
  expect(customElements.get(name)).toBe(Cls)
  expect(Object.getPrototypeOf(Cls)).toBe(HgElement)
})

test('the factory answers to the package name too, so a named import can spell it either way', () => {
  expect(hydrargyri).toBe(hg)
  const name = tag()
  expect(customElements.get(name)).toBeUndefined()
  const Cls = hydrargyri(name, ['foo'])
  expect(customElements.get(name)).toBe(Cls)
})

test('an observed attribute becomes a typed property, and setting it writes the attribute back', () => {
  const name = tag()
  hg(name, ['count'])
  const root = mount(`<${name} count="5"></${name}>`)
  const el = root.firstElementChild
  expect(el.count).toBe(5)
  el.count = 12
  expect(el.getAttribute('count')).toBe('12')
  expect(el.count).toBe(12)
})

test('a dashed attribute is reachable as its camelCase property', () => {
  const name = tag()
  hg(name, ['user-name'])
  const root = mount(`<${name} user-name="ada"></${name}>`)
  const el = root.firstElementChild
  expect(el.userName).toBe('ada')
  el.userName = 'grace'
  expect(el.getAttribute('user-name')).toBe('grace')
})

test('a valueless attribute reads as true, false removes it, true puts it back empty', () => {
  const name = tag()
  hg(name, ['active'])
  const root = mount(`<${name} active></${name}>`)
  const el = root.firstElementChild
  expect(el.active).toBe(true)
  el.active = false
  expect(el.hasAttribute('active')).toBe(false)
  expect(el.active).toBe(null)
  el.active = true
  expect(el.getAttribute('active')).toBe('')
})

test('a string-typed attribute reads back verbatim — the leading zero survives', () => {
  const name = tag()
  hg(name, ['zip:string', 'count'])
  const root = mount(`<${name} zip="007" count="007"></${name}>`)
  const el = root.firstElementChild
  expect(el.zip).toBe('007')
  expect(el.count).toBe(7)
})

test('a string-typed attribute keeps the empty string, and only absence reads null', () => {
  const name = tag()
  hg(name, ['note:string'])
  const root = mount(`<${name} note></${name}>`)
  const el = root.firstElementChild
  expect(el.note).toBe('')
  el.removeAttribute('note')
  expect(el.note).toBeNull()
})

test('a string-typed attribute round-trips through its accessor and paints verbatim', () => {
  const name = tag()
  hg(name, ['zip:string'])
  const root = mount(`<${name} zip="007"><span bind="zip"></span></${name}>`)
  const el = root.firstElementChild
  expect(el.querySelector('span').textContent).toBe('007')
  el.zip = '00042'
  expect(el.getAttribute('zip')).toBe('00042')
  expect(el.zip).toBe('00042')
  expect(el.querySelector('span').textContent).toBe('00042')
})

test('an unknown attribute type warns and the attribute falls back to the auto reading', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  hg(name, ['count:integer'])
  const root = mount(`<${name} count="5"></${name}>`)
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('string is the only type'))
  expect(root.firstElementChild.count).toBe(5)
})

test('a bare bind paints textContent from the attribute and repaints on setAttribute', () => {
  const name = tag()
  hg(name, ['count'])
  const root = mount(`<${name} count="5"><span bind="count">stale</span></${name}>`)
  const el = root.firstElementChild
  const span = el.querySelector('span')
  expect(span.textContent).toBe('5')
  el.setAttribute('count', '9')
  expect(span.textContent).toBe('9')
})

test('markup arriving through a text bind stays text, it cannot become elements', () => {
  const name = tag()
  hg(name, { properties: ['payload'] })
  const root = mount(`<${name}><span bind="payload"></span></${name}>`)
  const el = root.firstElementChild
  el.payload = '<img src=x onerror="boom()">'
  expect(el.querySelector('img')).toBe(null)
  expect(el.querySelector('span').textContent).toContain('<img')
})

test('a value bind fills the input, an attr bind sets the named attribute, an html bind parses', () => {
  const name = tag()
  hg(name, { properties: ['query', 'url', 'body'] })
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

test('a prop bind writes the value itself onto the node, which is the only way an array reaches another element', () => {
  const name = tag()
  hg(name, { properties: ['rows'] })
  const root = mount(`<${name}><ul bind="rows:prop#items"></ul></${name}>`)
  const el = root.firstElementChild
  const rows = [{ id: 1 }, { id: 2 }]
  el.rows = rows
  expect(el.querySelector('ul').items).toBe(rows)
  expect(el.querySelector('ul').hasAttribute('items')).toBe(false)
})

test('null through a prop bind is the value null — removing is what an attr bind does', () => {
  const name = tag()
  hg(name, { properties: ['rows'] })
  const root = mount(`<${name}><ul bind="rows:prop#items"></ul></${name}>`)
  const el = root.firstElementChild
  const ul = el.querySelector('ul')
  el.rows = ['salt']
  el.rows = null
  expect(ul.items).toBe(null)
  expect('items' in ul).toBe(true)
})

test('a prop bind with no name after the hash is refused at the parse, exactly as an attr bind is', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  expect(parseBinds('rows:prop')).toEqual([])
  expect(parseBinds('rows:prop#')).toEqual([])
  expect(parseBinds('rows:prop#items')).toEqual([
    { path: ['rows'], type: 'prop', attr: 'items', format: null }
  ])
  expect(warn).toHaveBeenCalledTimes(2)
})

test('a class bind toggles its named class and never touches the ones the author wrote', () => {
  const name = tag()
  hg(name, { properties: ['active'] })
  const root = mount(`<${name}><span bind="active:class#is-active" class="switch big"></span></${name}>`)
  const el = root.firstElementChild
  const span = el.querySelector('span')
  el.active = true
  expect(span.className).toBe('switch big is-active')
  el.active = false
  expect(span.className).toBe('switch big')
})

test('a falsy value removes the bound class, a truthy one adds it, and null removes', () => {
  const name = tag()
  hg(name, { properties: ['active'] })
  const root = mount(`<${name}><span bind="active:class#on" class="on"></span></${name}>`)
  const el = root.firstElementChild
  const span = el.querySelector('span')
  expect(span.classList.contains('on')).toBe(false)
  el.active = 'yes'
  expect(span.classList.contains('on')).toBe(true)
  el.active = null
  expect(span.classList.contains('on')).toBe(false)
})

test('a formatter shapes the value a class bind toggles on, exactly as it does for an attr bind', () => {
  const name = tag()
  hg(name, {
    properties: ['count'],
    formatters: { isLow: (n) => n > 0 && n < 3 }
  })
  const root = mount(`<${name}><p bind="count:class#low|isLow"></p></${name}>`)
  const el = root.firstElementChild
  const p = el.querySelector('p')
  el.count = 2
  expect(p.classList.contains('low')).toBe(true)
  el.count = 9
  expect(p.classList.contains('low')).toBe(false)
})

test('a class bind with no name after the hash is refused at the parse, exactly as an attr bind is', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  expect(parseBinds('active:class')).toEqual([])
  expect(parseBinds('active:class#')).toEqual([])
  expect(parseBinds('active:class#is-active')).toEqual([
    { path: ['active'], type: 'class', attr: 'is-active', format: null }
  ])
  expect(warn).toHaveBeenCalledTimes(2)
})

test('two class binds on one element stay independent, because nothing writes the class attribute as a whole', () => {
  const name = tag()
  hg(name, { properties: ['alive', 'busy'] })
  const root = mount(`<${name}><b bind="alive:class#is-alive;busy:class#is-busy" class="pill"></b></${name}>`)
  const el = root.firstElementChild
  const b = el.querySelector('b')
  el.alive = true
  el.busy = true
  expect(b.className).toBe('pill is-alive is-busy')
  el.alive = false
  expect(b.className).toBe('pill is-busy')
})

test('a class bind survives a reconnect, because the toggle remembers nothing between paints', () => {
  const name = tag()
  hg(name, { properties: ['active'] })
  const root = mount(`<${name}><span bind="active:class#is-active" class="switch"></span></${name}>`)
  const el = root.firstElementChild
  el.active = true
  el.remove()
  root.appendChild(el)
  expect(el.querySelector('span').className).toBe('switch is-active')
  el.active = false
  expect(el.querySelector('span').className).toBe('switch')
})

test('a false value removes a bound attribute, true sets it empty', () => {
  const name = tag()
  hg(name, { properties: ['busy'] })
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
  hg(name, ['count'])
  const root = mount(`<${name} count="3"><i bind="count:text;count:attr#data-n"></i></${name}>`)
  const i = root.querySelector('i')
  expect(i.textContent).toBe('3')
  expect(i.getAttribute('data-n')).toBe('3')
})

test('several elements bound to one key all repaint on a single set', () => {
  const name = tag()
  hg(name, { properties: ['msg'] })
  const root = mount(`<${name}><b bind="msg"></b><i bind="msg"></i></${name}>`)
  const el = root.firstElementChild
  el.msg = 'hi'
  expect(el.querySelector('b').textContent).toBe('hi')
  expect(el.querySelector('i').textContent).toBe('hi')
})

test('a dotted path renders the nested value, and a missing branch leaves the node alone', () => {
  const name = tag()
  hg(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.name">placeholder</span></${name}>`)
  const el = root.firstElementChild
  expect(el.querySelector('span').textContent).toBe('placeholder')
  el.user = { name: 'ada' }
  expect(el.querySelector('span').textContent).toBe('ada')
})

test('mutation inside an object is invisible until update(key) repaints it', () => {
  const name = tag()
  hg(name, { properties: ['user'] })
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
  hg(name, { properties: ['secret'] })
  const root = mount(`<${name}><span bind="secret"></span></${name}>`)
  const el = root.firstElementChild
  el.secret = 'hush'
  expect(el.hasAttribute('secret')).toBe(false)
  expect(el.querySelector('span').textContent).toBe('hush')
})

test('a declared handler fires with the event and the element', () => {
  const name = tag()
  const seen = []
  hg(name, {
    handlers: { poke: (e, el) => seen.push([e.type, el.tagName]) }
  })
  const root = mount(`<${name}><button on="click:poke">go</button></${name}>`)
  root.querySelector('button').click()
  expect(seen).toEqual([['click', name.toUpperCase()]])
})

test('a subclass method outranks the registry, and only one of the two runs', () => {
  const name = tag()
  const calls = []
  class El extends HgElement {
    static handlers = { poke: () => calls.push('registry') }
    poke() { calls.push('method') }
  }
  customElements.define(name, El)
  mount(`<${name} on="click:poke"></${name}>`).firstElementChild.click()
  expect(calls).toEqual(['method'])
})

test('a handler named after a platform method runs from the registry, never Element.prototype', () => {
  const name = tag()
  const calls = []
  hg(name, { handlers: { remove: (e, el) => calls.push(el.tagName) } })
  const root = mount(`<${name}><button on="click:remove">×</button></${name}>`)
  root.querySelector('button').click()
  expect(calls).toEqual([name.toUpperCase()])
  expect(root.querySelector(name)).not.toBeNull()
})

test('a platform-method name with no registry entry warns instead of detaching the element', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  hg(name, [])
  const root = mount(`<${name}><button on="click:remove"></button></${name}>`)
  root.querySelector('button').click()
  expect(root.querySelector(name)).not.toBeNull()
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('platform'))
})

test('an unknown handler warns instead of throwing', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  hg(name, [])
  const root = mount(`<${name}><button on="click:nope"></button></${name}>`)
  expect(() => root.querySelector('button').click()).not.toThrow()
  expect(warn).toHaveBeenCalled()
})

test('one on attribute wires several semicolon-separated events', () => {
  const name = tag()
  const seen = []
  hg(name, { handlers: { note: (e) => seen.push(e.type) } })
  const root = mount(`<${name}><input on="focus:note;input:note"></${name}>`)
  const input = root.querySelector('input')
  input.dispatchEvent(new Event('focus'))
  input.dispatchEvent(new Event('input'))
  expect(seen).toEqual(['focus', 'input'])
})

test('nested hydrargyri elements of different tags keep their binds and handlers to themselves', () => {
  const outer = tag()
  const inner = tag()
  hg(outer, { properties: ['msg'] })
  hg(inner, { properties: ['msg'] })
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

test('a tag defined after another has initialized still fences its own binds', () => {
  const outer = tag()
  hg(outer, { properties: ['msg'] })
  mount(`<${outer}><b bind="msg"></b></${outer}>`)
  const inner = tag()
  hg(inner, { properties: ['msg'] })
  const root = mount(`<${outer}><b bind="msg"></b><${inner}><i bind="msg"></i></${inner}></${outer}>`)
  const outerEl = root.firstElementChild
  outerEl.msg = 'out'
  expect(outerEl.querySelector('b').textContent).toBe('out')
  expect(outerEl.querySelector('i').textContent).toBe('')
})

test('same-tag nesting scopes binds to the nearest instance', () => {
  const name = tag()
  hg(name, ['label'])
  const root = mount(
    `<${name} label="a"><b bind="label"></b><${name} label="b"><i bind="label"></i></${name}></${name}>`
  )
  expect(root.querySelector('b').textContent).toBe('a')
  expect(root.querySelector('i').textContent).toBe('b')
})

test('a bind on the hydrargyri element itself works, scoped to itself', () => {
  const name = tag()
  hg(name, ['state'])
  const root = mount(`<${name} state="on" bind="state:attr#data-state"></${name}>`)
  expect(root.firstElementChild.getAttribute('data-state')).toBe('on')
})

test('a prop bind on the host writing its own reactive key is refused at scan, not painted into a stack overflow', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  hg(name, { properties: ['items'] })
  const root = mount(`<${name} bind="items:prop#items"></${name}>`)
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('feedback loop'))
  expect(() => { root.firstElementChild.items = [1, 2] }).not.toThrow()
})

test('a prop bind on the host writing a plain DOM property still works', () => {
  const name = tag()
  hg(name, ['label'])
  const root = mount(`<${name} label="hi" bind="label:prop#title"></${name}>`)
  expect(root.firstElementChild.title).toBe('hi')
})

test('a typo in a bind key warns once at scan and never throws on update', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  hg(name, ['count'])
  const root = mount(`<${name} count="1"><span bind="conut"></span></${name}>`)
  expect(warn).toHaveBeenCalled()
  expect(() => root.firstElementChild.update()).not.toThrow()
})

test('a malformed bind entry is skipped while its valid neighbours still paint', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  hg(name, ['count'])
  const root = mount(`<${name} count="2"><span bind="count:attr;count"></span></${name}>`)
  expect(warn).toHaveBeenCalled()
  expect(root.querySelector('span').textContent).toBe('2')
})

test('disconnecting unhooks handlers, reconnecting rescans and repaints', () => {
  const name = tag()
  const seen = []
  hg(name, { handlers: { poke: () => seen.push('hit') } })
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

test('rescan picks up swapped markup — new nodes wire and paint, detached ones are let go', () => {
  const name = tag()
  const seen = []
  hg(name, { attributes: ['count'], handlers: { poke: () => seen.push('hit') } })
  const root = mount(`<${name} count="1"><span bind="count"></span></${name}>`)
  const el = root.firstElementChild
  const stale = el.querySelector('span')
  el.innerHTML = '<i bind="count"></i><button on="click:poke"></button>'
  el.rescan()
  expect(el.querySelector('i').textContent).toBe('1')
  el.count = 2
  expect(el.querySelector('i').textContent).toBe('2')
  expect(stale.textContent).toBe('1')
  el.querySelector('button').click()
  expect(seen).toEqual(['hit'])
})

test('rescan before init is a no-op — connect stays the first scan', () => {
  const name = tag()
  hg(name, ['count'])
  const el = document.createElement(name)
  expect(() => el.rescan()).not.toThrow()
  el.innerHTML = '<span bind="count"></span>'
  el.setAttribute('count', '3')
  document.body.appendChild(el)
  expect(el.querySelector('span').textContent).toBe('3')
})

test('the connected hook runs after binds are painted, disconnected on removal', () => {
  const name = tag()
  const seen = []
  hg(name, {
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
  hg(name, {
    attributes: ['count'],
    attributeChanged: (attr, oldValue, newValue) => seen.push([attr, oldValue, newValue])
  })
  const root = mount(`<${name} count="1"></${name}>`)
  expect(seen).toEqual([])
  root.firstElementChild.count = 2
  expect(seen).toEqual([['count', 1, 2]])
})

test('the element wears an hg attribute only once initialized, so unbound markup can be styled', () => {
  const name = tag()
  hg(name, [])
  const el = document.createElement(name)
  expect(el.hasAttribute('hg')).toBe(false)
  document.body.appendChild(el)
  expect(el.hasAttribute('hg')).toBe(true)
})

test('while the document is parsing, init waits for DOMContentLoaded to see all children', () => {
  const name = tag()
  hg(name, ['count'])
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
  hg(name, ['count'])
  expect(el.getAttribute('count')).toBe('5')
  expect(el.count).toBe(5)
})

test('a name colliding with the hydrargyri API or a native warns and is skipped, the element survives', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  hg(name, ['update', 'title', 'count'])
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
  hg(name, {
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
  hg(name, { properties: ['state', 'body'] })
  const root = mount(`<${name}><i bind="state:attr#data-state"></i><div bind="body:html"></div></${name}>`)
  const el = root.firstElementChild
  el.state = 'on'
  el.body = '<b>x</b>'
  el.state = null
  el.body = null
  expect(el.querySelector('i').hasAttribute('data-state')).toBe(false)
  expect(el.querySelector('div').innerHTML).toBe('')
})

test('a bubbling custom event from a child element reaches the parent hydrargyri handler', () => {
  const parent = tag()
  const child = tag()
  const seen = []
  hg(child, {
    handlers: {
      pick: (e, el) => el.dispatchEvent(new CustomEvent('picked', { bubbles: true, detail: { sku: 7 } }))
    }
  })
  hg(parent, {
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
  hg(parent, [])
  hg(child, ['sku'])
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

test('a command routes to the handler wearing its exact name, with the event and the element', () => {
  const name = tag()
  const seen = []
  hg(name, {
    attributes: ['count'],
    handlers: {
      '--add-item': (e, el) => seen.push([e.command, el.tagName])
    }
  })
  const root = mount(`<${name} count="0"></${name}>`)
  root.firstElementChild.dispatchEvent(commandEvent('--add-item'))
  expect(seen).toEqual([['--add-item', name.toUpperCase()]])
})

test('one handler under a command key answers both the command and an on listener', () => {
  const name = tag()
  const seen = []
  hg(name, {
    handlers: { '--add-item': (e) => seen.push(e.type) }
  })
  const root = mount(`<${name}><button on="click:--add-item"></button></${name}>`)
  root.querySelector('button').click()
  root.firstElementChild.dispatchEvent(commandEvent('--add-item'))
  expect(seen).toEqual(['click', 'command'])
})

test('an unknown command warns only when a command key is declared — plain handlers keep the silence', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const quiet = tag()
  const plain = tag()
  const loud = tag()
  hg(quiet, [])
  hg(plain, { handlers: { greet: () => {} } })
  hg(loud, { handlers: { '--known': () => {} } })
  const root = mount(`<${quiet}></${quiet}><${plain}></${plain}><${loud}></${loud}>`)
  root.querySelector(quiet).dispatchEvent(commandEvent('--whatever'))
  root.querySelector(plain).dispatchEvent(commandEvent('--whatever'))
  expect(warn).not.toHaveBeenCalled()
  root.querySelector(loud).dispatchEvent(commandEvent('--typo'))
  expect(warn).toHaveBeenCalledTimes(1)
})

test('a command handler assigned at runtime routes without any re-wiring', () => {
  const name = tag()
  const seen = []
  hg(name, [])
  const root = mount(`<${name}></${name}>`)
  const el = root.firstElementChild
  el.handlers['--late'] = (e, el) => seen.push(el.tagName)
  el.dispatchEvent(commandEvent('--late'))
  expect(seen).toEqual([name.toUpperCase()])
})

test('a node handed to _wireHandlers alone gets its listeners, no rescan and no teardown around it', () => {
  const name = tag()
  const seen = []
  hg(name, { handlers: { poke: () => seen.push('hit') } })
  const root = mount(`<${name}><button on="click:early"></button></${name}>`)
  const el = root.firstElementChild
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  const standing = el._listeners.length
  const late = document.createElement('button')
  late.setAttribute('on', 'click:poke')
  el.appendChild(late)
  el._wireHandlers(late)
  late.click()
  expect(seen).toEqual(['hit'])
  expect(el._listeners.length).toBe(standing + 1)
})

test('the command router survives a rescan', () => {
  const name = tag()
  const seen = []
  hg(name, { handlers: { '--add-item': (e) => seen.push(e.command) } })
  const root = mount(`<${name}></${name}>`)
  const el = root.firstElementChild
  el.innerHTML = '<b></b>'
  el.rescan()
  el.dispatchEvent(commandEvent('--add-item'))
  expect(seen).toEqual(['--add-item'])
})

test('an if bind shows the node while the named condition holds, and hides it when it stops', () => {
  const name = tag()
  const seen = []
  hg(name, {
    properties: ['items'],
    conditions: {
      // Runs on the initial paint too, where an unassigned property is null —
      // a condition owns every value the key can hold.
      isEmpty: (items, el) => {
        seen.push(el.tagName)
        return !items?.length
      }
    }
  })
  const root = mount(`<${name}><p bind="items:if#isEmpty">empty</p></${name}>`)
  const el = root.firstElementChild
  el.items = []
  expect(el.querySelector('p').hasAttribute('hidden')).toBe(false)
  el.items = [1]
  expect(el.querySelector('p').hasAttribute('hidden')).toBe(true)
  expect(seen).toEqual([name.toUpperCase(), name.toUpperCase(), name.toUpperCase()])
})

test('a bare if bind follows truthiness with no condition declared', () => {
  const name = tag()
  hg(name, ['done'])
  const root = mount(`<${name}><span bind="done:if">done!</span></${name}>`)
  const el = root.firstElementChild
  expect(el.querySelector('span').hasAttribute('hidden')).toBe(true)
  el.done = true
  expect(el.querySelector('span').hasAttribute('hidden')).toBe(false)
})

test('an unknown condition warns and leaves the node as authored', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  hg(name, ['count'])
  const root = mount(`<${name} count="1"><p bind="count:if#missing">kept</p></${name}>`)
  expect(warn).toHaveBeenCalledTimes(1)
  expect(root.querySelector('p').hasAttribute('hidden')).toBe(false)
})

test('if and unless on one key are a full else in markup, no predicate needed', () => {
  const name = tag()
  hg(name, ['count'])
  const root = mount(
    `<${name} count="0"><p bind="count:if">some</p><p bind="count:unless">none</p></${name}>`
  )
  const el = root.firstElementChild
  const [some, none] = el.querySelectorAll('p')
  expect(some.hasAttribute('hidden')).toBe(true)
  expect(none.hasAttribute('hidden')).toBe(false)
  el.count = 5
  expect(some.hasAttribute('hidden')).toBe(false)
  expect(none.hasAttribute('hidden')).toBe(true)
})

test('an unless bind inverts its named condition', () => {
  const name = tag()
  hg(name, {
    attributes: ['count'],
    conditions: { isLow: (n) => n < 3 }
  })
  const root = mount(`<${name} count="1"><p bind="count:unless#isLow">plenty</p></${name}>`)
  const el = root.firstElementChild
  expect(el.querySelector('p').hasAttribute('hidden')).toBe(true)
  el.count = 5
  expect(el.querySelector('p').hasAttribute('hidden')).toBe(false)
})

test('a condition assigned at runtime answers on the next repaint', () => {
  const name = tag()
  hg(name, ['count'])
  const root = mount(`<${name} count="3"><p bind="count:if#isEven">even</p></${name}>`)
  const el = root.firstElementChild
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  el.conditions.isEven = (n) => n % 2 === 0
  el.update('count')
  expect(el.querySelector('p').hasAttribute('hidden')).toBe(true)
  el.count = 4
  expect(el.querySelector('p').hasAttribute('hidden')).toBe(false)
})

test('a formatter shapes what is painted while a value bind on the same key stays raw', () => {
  const name = tag()
  hg(name, {
    attributes: ['price'],
    formatters: { money: (v) => v === null ? '' : `$${Number(v).toFixed(2)}` }
  })
  const root = mount(`<${name} price="9.5"><input bind="price:value"><span bind="price|money"></span></${name}>`)
  const el = root.firstElementChild
  expect(el.querySelector('input').value).toBe('9.5')
  expect(el.querySelector('span').textContent).toBe('$9.50')
  el.price = 12
  expect(el.querySelector('input').value).toBe('12')
  expect(el.querySelector('span').textContent).toBe('$12.00')
})

test('a formatter argument names a property, and changing that property repaints the formatted bind', () => {
  const name = tag()
  hg(name, {
    attributes: ['price', 'currency'],
    formatters: { money: (v, el, currency) => `${currency} ${Number(v).toFixed(2)}` }
  })
  const root = mount(`<${name} price="9.5" currency="USD"><span bind="price|money:currency"></span></${name}>`)
  const el = root.firstElementChild
  expect(el.querySelector('span').textContent).toBe('USD 9.50')
  el.currency = 'EUR'
  expect(el.querySelector('span').textContent).toBe('EUR 9.50')
})

test('a formatter argument may be a path, walked like a bind path', () => {
  const name = tag()
  hg(name, {
    attributes: ['price'],
    properties: ['settings'],
    formatters: { money: (v, el, currency) => `${currency} ${v}` }
  })
  const root = mount(`<${name} price="5"><span bind="price|money:settings.currency"></span></${name}>`)
  const el = root.firstElementChild
  el.settings = { currency: 'JPY' }
  expect(el.querySelector('span').textContent).toBe('JPY 5')
})

test('a formatter owns every value the key can hold, the initial null included', () => {
  const name = tag()
  const seen = []
  hg(name, {
    properties: ['due'],
    formatters: {
      human: (v) => {
        seen.push(v)
        return v === null ? 'sometime' : `by ${v}`
      }
    }
  })
  const root = mount(`<${name}><span bind="due|human"></span></${name}>`)
  const el = root.firstElementChild
  expect(el.querySelector('span').textContent).toBe('sometime')
  el.due = 'Friday'
  expect(el.querySelector('span').textContent).toBe('by Friday')
  expect(seen).toEqual([null, 'Friday'])
})

test('a formatter never sees undefined — a missing path leaves the node alone', () => {
  const name = tag()
  const seen = []
  hg(name, {
    properties: ['user'],
    formatters: {
      shout: (v) => {
        seen.push(v)
        return String(v).toUpperCase()
      }
    }
  })
  const root = mount(`<${name}><span bind="user.name|shout">as authored</span></${name}>`)
  const el = root.firstElementChild
  expect(el.querySelector('span').textContent).toBe('as authored')
  expect(seen).toEqual([])
  el.user = { name: 'ada' }
  expect(el.querySelector('span').textContent).toBe('ADA')
  expect(seen).toEqual(['ada'])
})

test('an unknown formatter warns and paints the raw value', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  hg(name, ['price'])
  const root = mount(`<${name} price="9.5"><span bind="price|missing"></span></${name}>`)
  expect(warn).toHaveBeenCalledTimes(1)
  expect(root.querySelector('span').textContent).toBe('9.5')
})

test('a formatter assigned at runtime answers on the next repaint', () => {
  const name = tag()
  hg(name, ['price'])
  const root = mount(`<${name} price="2"><span bind="price|double"></span></${name}>`)
  const el = root.firstElementChild
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  el.formatters.double = (v) => v * 2
  el.update('price')
  expect(el.querySelector('span').textContent).toBe('4')
})

test('a formatter argument that names nothing the element owns warns at scan and skips the entry', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  hg(name, { attributes: ['price'], formatters: { money: (v) => v } })
  const root = mount(`<${name} price="1"><span bind="price|money:nope">kept</span></${name}>`)
  expect(warn).toHaveBeenCalledTimes(1)
  expect(root.querySelector('span').textContent).toBe('kept')
})

test('a formatter on an if or unless bind warns and the toggle still follows the value', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  hg(name, { attributes: ['count'], formatters: { pretty: (v) => `#${v}` } })
  const root = mount(`<${name} count="1"><p bind="count:if|pretty">shown</p></${name}>`)
  expect(warn).toHaveBeenCalledTimes(1)
  expect(root.querySelector('p').hasAttribute('hidden')).toBe(false)
})

test('an @window or @document event reaches the handler from outside the element, and disconnect unhooks both', () => {
  const name = tag()
  const seen = []
  hg(name, { handlers: { note: (e, el) => seen.push([e.type, el.tagName]) } })
  const root = mount(`<${name} on="ping@window:note;pong@document:note"></${name}>`)
  window.dispatchEvent(new Event('ping'))
  document.dispatchEvent(new Event('pong'))
  expect(seen).toEqual([['ping', name.toUpperCase()], ['pong', name.toUpperCase()]])
  root.firstElementChild.remove()
  window.dispatchEvent(new Event('ping'))
  document.dispatchEvent(new Event('pong'))
  expect(seen).toEqual([['ping', name.toUpperCase()], ['pong', name.toUpperCase()]])
})

test('an unknown @target warns and is skipped while its neighbours still wire', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  const seen = []
  hg(name, { handlers: { poke: () => seen.push('hit') } })
  const root = mount(`<${name} on="click@body:poke;click:poke"></${name}>`)
  expect(warn).toHaveBeenCalledTimes(1)
  root.firstElementChild.click()
  expect(seen).toEqual(['hit'])
})

test('a reactive model repaints every element it is assigned to, no update() in sight', async () => {
  const a = tag()
  const b = tag()
  hg(a, { properties: ['user'] })
  hg(b, { properties: ['user'] })
  const root = mount(`<${a}><span bind="user.name"></span></${a}><${b}><i bind="user.name"></i></${b}>`)
  const user = reactive({ name: 'ada' })
  root.querySelector(a).user = user
  root.querySelector(b).user = user
  user.name = 'grace'
  await null
  expect(root.querySelector('span').textContent).toBe('grace')
  expect(root.querySelector('i').textContent).toBe('grace')
})

test('mutation deep inside a reactive model repaints through the path bind', async () => {
  const name = tag()
  hg(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.prefs.theme"></span></${name}>`)
  const el = root.firstElementChild
  el.user = reactive({ prefs: { theme: 'dark' } })
  expect(el.querySelector('span').textContent).toBe('dark')
  el.user.prefs.theme = 'light'
  await null
  expect(el.querySelector('span').textContent).toBe('light')
})

test('mutating the raw original does nothing — the proxy is the contract', async () => {
  const name = tag()
  hg(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.name"></span></${name}>`)
  const el = root.firstElementChild
  const raw = { name: 'ada' }
  const user = reactive(raw)
  el.user = user
  raw.name = 'grace'
  await null
  expect(el.querySelector('span').textContent).toBe('ada')
  user.name = 'ida'
  await null
  expect(el.querySelector('span').textContent).toBe('ida')
})

test('reactive() on the same object twice is the same model, so subscribers cannot split', async () => {
  const name = tag()
  hg(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.name"></span></${name}>`)
  const el = root.firstElementChild
  const raw = { name: 'ada' }
  const first = reactive(raw)
  const second = reactive(raw)
  expect(second).toBe(first)
  el.user = first
  second.name = 'grace'
  await null
  expect(el.querySelector('span').textContent).toBe('grace')
})

test('a disconnected element stops repainting, reconnecting catches it up', async () => {
  const name = tag()
  hg(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.name"></span></${name}>`)
  const el = root.firstElementChild
  const user = reactive({ name: 'ada' })
  el.user = user
  el.remove()
  user.name = 'grace'
  await null
  expect(el.querySelector('span').textContent).toBe('ada')
  root.appendChild(el)
  expect(el.querySelector('span').textContent).toBe('grace')
  user.name = 'ida'
  await null
  expect(el.querySelector('span').textContent).toBe('ida')
})

test('a model assigned before upgrade still subscribes once the element initializes', async () => {
  const name = tag()
  const el = document.createElement(name)
  const user = reactive({ name: 'ada' })
  el.user = user
  el.innerHTML = '<span bind="user.name"></span>'
  document.body.appendChild(el)
  hg(name, { properties: ['user'] })
  expect(el.querySelector('span').textContent).toBe('ada')
  user.name = 'grace'
  await null
  expect(el.querySelector('span').textContent).toBe('grace')
})

test('markup stamped from a template before define binds like authored markup', async () => {
  const name = tag()
  const root = mount(`<template><span bind="user.name">…</span></template><${name}></${name}>`)
  const el = root.querySelector(name)
  el.append(root.querySelector('template').content.cloneNode(true))
  const user = reactive({ name: 'ada' })
  hg(name, { properties: { user } })
  expect(el.querySelector('span').textContent).toBe('ada')
  user.name = 'grace'
  await null
  expect(el.querySelector('span').textContent).toBe('grace')
})

test('reassigning a property unsubscribes the old model', async () => {
  const name = tag()
  hg(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.name"></span></${name}>`)
  const el = root.firstElementChild
  const old = reactive({ name: 'ada' })
  el.user = old
  el.user = reactive({ name: 'grace' })
  const update = jest.spyOn(el, 'update')
  old.name = 'ghost'
  await null
  expect(update).not.toHaveBeenCalled()
})

test('writing an element back to its own index repaints nothing — sort on a sorted array included', async () => {
  const name = tag()
  hg(name, { properties: ['cart'] })
  const root = mount(`<${name}><span bind="cart.length"></span></${name}>`)
  const el = root.firstElementChild
  const cart = reactive([{ id: 1 }, { id: 2 }])
  el.cart = cart
  const update = jest.spyOn(el, 'update')
  const first = cart[0] // read through the proxy, so this is the wrapper
  cart[0] = first
  cart.sort((a, b) => a.id - b.id)
  await null
  expect(update).not.toHaveBeenCalled()
  cart.reverse()
  await null
  expect(update).toHaveBeenCalledTimes(1)
})

test('an array push inside a reactive model repaints its binds', async () => {
  const name = tag()
  hg(name, { properties: ['cart'] })
  const root = mount(`<${name}><span bind="cart.length"></span></${name}>`)
  const el = root.firstElementChild
  const cart = reactive([])
  el.cart = cart
  expect(el.querySelector('span').textContent).toBe('0')
  cart.push('salt')
  await null
  expect(el.querySelector('span').textContent).toBe('1')
})

test('a splice repaints once with the final array — the intermediate shifts are never painted', async () => {
  const name = tag()
  const seen = []
  hg(name, {
    properties: ['cart'],
    formatters: { joined: (v) => { const s = v === null ? '' : v.join(','); seen.push(s); return s } }
  })
  const root = mount(`<${name}><span bind="cart|joined"></span></${name}>`)
  const el = root.firstElementChild
  const cart = reactive(['a', 'b', 'c', 'd'])
  el.cart = cart
  seen.length = 0
  cart.splice(0, 1)
  await null
  expect(el.querySelector('span').textContent).toBe('b,c,d')
  expect(seen).toEqual(['b,c,d'])
})

test('share reaches every existing instance and every future one', () => {
  const name = tag()
  const Cls = hg(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.name"></span></${name}><${name}><i bind="user.name"></i></${name}>`)
  Cls.share({ user: { name: 'ada' } })
  expect(root.querySelector('span').textContent).toBe('ada')
  expect(root.querySelector('i').textContent).toBe('ada')
  const late = document.createElement(name)
  late.innerHTML = '<b bind="user.name"></b>'
  document.body.appendChild(late)
  expect(late.querySelector('b').textContent).toBe('ada')
})

test('an instance assignment outranks share, and reconnecting cannot stomp it', () => {
  const name = tag()
  const Cls = hg(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.name"></span></${name}><${name}><i bind="user.name"></i></${name}>`)
  const mine = root.firstElementChild
  mine.user = { name: 'mine' }
  Cls.share({ user: { name: 'shared' } })
  expect(mine.querySelector('span').textContent).toBe('mine')
  expect(root.querySelector('i').textContent).toBe('shared')
  mine.remove()
  root.appendChild(mine)
  expect(mine.querySelector('span').textContent).toBe('mine')
})

test('share with a reactive model is a live broadcast to every instance, late ones included', async () => {
  const name = tag()
  const Cls = hg(name, { properties: ['user'] })
  const root = mount(`<${name}><span bind="user.name"></span></${name}>`)
  const model = reactive({ name: 'ada' })
  Cls.share({ user: model })
  expect(root.querySelector('span').textContent).toBe('ada')
  const late = document.createElement(name)
  late.innerHTML = '<b bind="user.name"></b>'
  document.body.appendChild(late)
  model.name = 'grace'
  await null
  expect(root.querySelector('span').textContent).toBe('grace')
  expect(late.querySelector('b').textContent).toBe('grace')
})

test('sharing null releases the model everywhere share put it, and spares direct assignments', () => {
  const name = tag()
  const Cls = hg(name, { properties: ['user'] })
  const root = mount(`<${name}></${name}><${name}></${name}>`)
  const [mine, theirs] = root.children
  const model = reactive({ name: 'ada' })
  Cls.share({ user: model })
  mine.user = model
  Cls.share({ user: null })
  expect(mine.user).toBe(model)
  expect(theirs.user).toBe(null)
  const late = document.createElement(name)
  document.body.appendChild(late)
  expect(late.user).toBe(null)
})

test('properties as an object declares the keys and shares the values class-wide', async () => {
  const name = tag()
  const user = reactive({ name: 'ada' })
  hg(name, { properties: { user, draft: null } })
  const root = mount(`<${name}><span bind="user.name"></span></${name}>`)
  expect(root.querySelector('span').textContent).toBe('ada')
  user.name = 'grace'
  await null
  expect(root.querySelector('span').textContent).toBe('grace')
  const late = document.createElement(name)
  late.innerHTML = '<b bind="user.name"></b>'
  document.body.appendChild(late)
  expect(late.querySelector('b').textContent).toBe('grace')
  late.draft = 'mine'
  expect(late.draft).toBe('mine')
  expect(root.firstElementChild.draft).toBe(null)
})

test('a runtime share overrides a declared default, for instances present and future', () => {
  const name = tag()
  const first = reactive({ name: 'first' })
  const second = reactive({ name: 'second' })
  const Cls = hg(name, { properties: { user: first } })
  const root = mount(`<${name}><span bind="user.name"></span></${name}>`)
  expect(root.querySelector('span').textContent).toBe('first')
  Cls.share({ user: second })
  expect(root.querySelector('span').textContent).toBe('second')
  const late = document.createElement(name)
  late.innerHTML = '<b bind="user.name"></b>'
  document.body.appendChild(late)
  expect(late.querySelector('b').textContent).toBe('second')
})

test('a dashed property name shares under its camelCase self, from either form', () => {
  const name = tag()
  const Cls = hg(name, { properties: ['user-data'] })
  const root = mount(`<${name}><span bind="userData.name"></span></${name}>`)
  Cls.share({ 'user-data': { name: 'ada' } })
  expect(root.querySelector('span').textContent).toBe('ada')
})

test('share refuses an attribute-backed or undeclared key with a warning, and the rest still lands', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const name = tag()
  const Cls = hg(name, { attributes: ['count'], properties: ['user'] })
  const root = mount(`<${name} count="1"><span bind="user.name"></span></${name}>`)
  Cls.share({ count: 9, nope: true, user: { name: 'ada' } })
  expect(warn).toHaveBeenCalledTimes(2)
  expect(root.firstElementChild.getAttribute('count')).toBe('1')
  expect(root.querySelector('span').textContent).toBe('ada')
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

test('parseBinds is exported and parses the grammar an ecosystem package paints with', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  expect(parseBinds('user.name; count:attr#value')).toEqual([
    { path: ['user', 'name'], type: 'text', attr: null, format: null },
    { path: ['count'], type: 'attr', attr: 'value', format: null }
  ])
  expect(parseBinds('x:nope; y:html')).toEqual([{ path: ['y'], type: 'html', attr: null, format: null }])
  expect(warn).toHaveBeenCalledTimes(1)
})

test('parseBinds carries the formatter name and its argument paths, and refuses chaining', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  expect(parseBinds('price:value|money:currency; total|sum:cart.items:tax')).toEqual([
    { path: ['price'], type: 'value', attr: null, format: { name: 'money', args: [['currency']] } },
    { path: ['total'], type: 'text', attr: null, format: { name: 'sum', args: [['cart', 'items'], ['tax']] } }
  ])
  expect(parseBinds('x|; y|a|b; z|ok')).toEqual([
    { path: ['z'], type: 'text', attr: null, format: { name: 'ok', args: [] } }
  ])
  expect(warn).toHaveBeenCalledTimes(2)
})
