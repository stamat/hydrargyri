---
layout: default
---

# <sup>🜔</sup> {{ site.title }}
<p class="p1">{{ site.description }}<p>
<div>
  <salis-element test="baz" foo="bar">
    <div bind="attr2">
      45
    </div>
    <button event="click:yell">Yell</button>
    <salis-element test="foo">
      <div bind="attr2">
        34
      </div>
      <button on="click:yell">Yell</button>
    </salis-element>
  </salis-element>
</div>
