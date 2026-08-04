---
layout: poops-docs-theme/docs
title: Composition
description: Elements talking to each other — events up, attributes down, the platform's own protocol and no bus.
order: 4
---

# Elements talking to each other

Events up, attributes down — the platform's own protocol, and salis already
speaks both halves. There is no bus, no store, no `$dispatch`: [`on`](on.html)
listens to any event name, custom events included, and they bubble.

<!-- demo -->

```html
<demo-cart on="item-picked:refresh">
  <p>Picked: <output bind="count">0</output></p>
  <demo-item sku="7"><button on="click:pick">add sku 7</button></demo-item>
  <demo-item sku="9"><button on="click:pick">add sku 9</button></demo-item>
</demo-cart>
```

```js demo
salis("demo-item", {
  attributes: ["sku"],
  handlers: {
    pick(e, el) {
      el.dispatchEvent(
        new CustomEvent("item-picked", {
          bubbles: true,
          detail: { sku: el.sku },
        }),
      );
    },
  },
});

salis("demo-cart", {
  properties: ["count"],
  connected(el) {
    el.count = 0;
  },
  handlers: {
    refresh(e, el) {
      el.count += 1;
    },
  },
});
```

The cart's `on` sits on the cart, and the event is raised two levels down. It
arrives because it bubbles, and because a nested salis element does not swallow
what passes through it.

## The footgun is the platform's

Forget `bubbles: true` and the event reaches nobody, silently — `CustomEvent`
defaults it to `false`, and nothing in salis or the browser will tell you. It
is the one line in this page worth remembering.

## Downwards

Plainer still. A parent writes a child's observed attribute, and the child
repaints and reacts on its own:

```js
el.querySelector("demo-item").sku = 9;
```

That is not a salis API — it is a property on a custom element, set the way any
property is set. The child's attribute changes, its binds repaint, and its
`attributeChanged` runs. Nothing had to be registered for that to work.

## Sideways

Siblings never hear each other: an event travels up, not across. So the two
halves above compose into the third — the common ancestor catches the bubbling
event and writes the other sibling.

<!-- demo -->

```html
<demo-mixer on="dose-picked:pour">
  <demo-dose amount="1"><button on="click:pick">add 1</button></demo-dose>
  <demo-dose amount="5"><button on="click:pick">add 5</button></demo-dose>
  <demo-vessel amount="0">
    <p>In the vessel: <output bind="amount">0</output></p>
  </demo-vessel>
</demo-mixer>
```

```js demo
salis("demo-dose", {
  attributes: ["amount"],
  handlers: {
    pick(e, el) {
      el.dispatchEvent(
        new CustomEvent("dose-picked", {
          bubbles: true,
          detail: { amount: el.amount },
        }),
      );
    },
  },
});

salis("demo-vessel", { attributes: ["amount"] });

salis("demo-mixer", {
  handlers: {
    pour(e, el) {
      el.querySelector("demo-vessel").amount += e.detail.amount;
    },
  },
});
```

The relay writes a property, never the sibling's nodes. `bind="amount"` inside
`demo-vessel` belongs to `demo-vessel` — binds go to the nearest salis ancestor,
and a salis element is its own — so the mixer could not paint that `<output>`
even if it tried. It sets the value; the vessel repaints itself.

Which is also why the relay has to be a salis element: it needs an `on` of its
own to catch the event. A plain `<div>` between two siblings relays nothing.

## No common ancestor at all

A button in the header, the element it drives at the bottom of the page. The
platform's own answer is
[`commandfor`/`command`](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API):
the button names any element by id, the browser fires a `command` event **on
that element**, and `actions` answers it.

```html
<button commandfor="cart" command="--add-item">Add</button>
<!-- …anywhere else in the document… -->
<x-cart id="cart">…</x-cart>
```

```js
salis("x-cart", {
  attributes: ["count"],
  actions: {
    "--add-item": (e, el) => {
      el.count += 1;
    },
  },
});
```

`actions` is the command counterpart of `handlers`: command issued, action
taken. Keys are the exact `command` strings, dashes and all — no name
transformation to reason backwards through. An unknown command warns; an
element with no actions declared stays silent, since `on="command:name"` can
handle commands its own way instead.

Baseline newly available (December 2025). Older browsers leave the button inert
— nothing breaks and nothing happens, which is the failure mode to weigh before
choosing it. A page that must work everywhere keeps the bubbling event above,
or loads [invokers-polyfill](https://github.com/keithamus/invokers-polyfill)
itself — salis does not bundle it, since an element only listens and a page
using no commands should not pay for one.

[The proposal](https://open-ui.org/components/invokers.explainer/) and the
polyfill both trace to [@keithamus](https://github.com/keithamus) with
[@lukewarlow](https://github.com/lukewarlow) co-championing the spec. `actions` exists because that work made commands worth
answering.

There is no live preview here for that reason: it would demonstrate one thing
in a current browser and an empty box in an older one, without saying which you
were looking at.

## Scope, and where it stops

| Between                   | Through                                                 |
| ------------------------- | ------------------------------------------------------- |
| child → ancestor          | a bubbling event, caught by the ancestor's `on`         |
| parent → child            | writing the child's observed attribute                  |
| sibling → sibling         | both of the above, via their common ancestor            |
| any element → any element | `commandfor`/`command`, where the browser is new enough |
| anything wider            | the page's job, not salis's                             |

State shared across a whole page — a session, a router, a cart that outlives the
markup around it — belongs to the page. Salis holds state on elements, and an
element is a subtree. A library that solved the wider case would need a store,
and a store is the thing this one refuses to grow.

## Nesting

Binds and handlers belong to the **nearest** salis ancestor, whatever its tag —
so a salis element inside another salis element keeps its own nodes, and neither
paints into the other's. That is what makes the cart above work: `bind="count"`
is the cart's, `on="click:pick"` is the item's, and the two do not negotiate.
