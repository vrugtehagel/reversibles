## Helper reversible: pause

A small example for how to use `reversible.define`, implementing a timer.

## Usage

It's fairly simple. This defines a function `pause` that accepts one or two arguments. The first is the duration of the pause; the second is an optional options object, which currently allows one option `repeat`. If `repeat` is set to `true`, it will keep firing the callback given to `.then`, giving you a `setInterval`-like functionality. If left out or set to `false`, it will fire the `.then` callback only once. So, use along the lines of:
```js
toast.show('Message sent!')
await pause(5000)
toast.hide()

pause(60000).then(() => afterAMinute())

pause(1000, {repeat: true})
    .then(() => { /* update inaccurate clock */ })
```
The "undo" essentially just calls `clearTimeout`, stopping it from firing the callback(s). For example,
```js
const {undo} = pause.do(1000).then(() => deleteSystem32())
// oh no! Stop!
undo()
// phew...
```
