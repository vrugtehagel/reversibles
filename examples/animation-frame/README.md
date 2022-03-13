## Helper reversible: animationFrame

A small example for how to use `reversible.define`, implementing a requestAnimationFrame cycle.

## Usage

It's fairly simple. This defines a function `animationFrame` that accepts one optional argument; an options object, which currently allows one option `repeat`. If `repeat` is set to `true`, it will keep firing the callback given to `.then` every frame. If left out or set to `false`, it will fire the `.then` callback only once. So, use along the lines of:
```js
div.classList.add('reset')
await animationFrame()
div.classList.remove('reset')

animationFrame({repeat: true})
    .then(() => { /* update your animations */ })
```
