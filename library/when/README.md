# Helper reversible: when

A simple, readable, _and_ reversible way to do event listeners and observers.

## Usage

Let's look at some examples straight away.
```js
await when(document).does('DOMContentLoaded')
when(input).changes().then(event => { /* do something */ })
when(image).loads({once: true})
    .after(() => image.src = 'cute-cats.png')
    .then(() => document.body.append(image))
when(document.documentElement)
    .observes('mutation', {attributes: true})
    .then(mutations => { /* toggle dark mode or whatever */ })
when(input).does('keydown')
    .only(event => event.key == 'Enter')
    .then(() => form.submit())
```
These are all a tad different. For one, observers have little to do with event listeners; they act on elements, not event targets (elements happen to also be event targets, but that's irrelevant). Let's look at the possiblilities.


## Event listeners

For these, `when` expects one argument, an `EventTarget`. Then, you can call `.does()` on it, with either one or two arguments. The first is the event type (e.g. 'load', 'change', 'click') and the second, optional argument will be passed as third argument to `addEventListener`. This way, you can use things like `passive` or `once`.

That `.does()` call then returns a 'thenable', i.e. an object with a `then` method on it. That `then` method takes a callback (as you probably guessed) which receives one argument; the `event` object. Those `then`s are chainable, and because it's a thenable, it means you can `await` them as well. Also, only after having called `then` on that will an event listener actually be added. That means that something like `when(window).does('load')` actually doesn't do anything, and will not create event listeners. Note that `await when(window).does('load')` will, because `await` is syntactic sugar that calls `then` under the hood. All in all, you get this:
```js
when(eventTarget).does(eventType, options)
    .then(event => { /* stuff */ })
    .then(event => { /* more stuff */ })
```
As you've seen in the example, `does` chains into more than just `.then()` - more on that in the [`chaining`](#chaining) section.


### Shorthand

To make things a tad nicer and shorter, you're getting "sugar" for `does`. Instead of doing `.does(eventType, options)`, you may write `.eventTypes(options)`. Note the extra `s` there; that's to make nice readable sentences. That works for most event types, but a few of them are a bit awkward with it:
```js
when(window).loads()
// is identical to
when(window).does('load')

// however, these probably should just use .does()`
when(document).gotpointercaptures() // bit awkward
when(element).copys() // not even proper English
when(input).searchs() // also not English
when(element).focuss() // needs two s's to work, so maybe don't
when(idbRequest).successs() // same issue, but worse
```
You may also omit the `s`, but the event name will be the thing you write _without the last s_. If there is no "s" at the end, it will be used as-is, but that does mean things like `.focus()` will actually attach an event listener for the `focu` event.

Some of you may think this is stupid and feels hacky. I understand. That's why I'm letting you turn it off. Simply do `when.strict = true` and voila - you can now just write `when(input).focus()` and `when(button).click()`.

## Observers

Observers, like `MutationObserver`, `IntersectionObserver` and `ResizeObserver` are a good fit for this syntax as well. These are a bit less common, so they don't have a shorthand. They all work through `.observes()` rather than `.does()` - additionally, they require the argument to `when` to be an HTML element, as it will be passed to the observer. The `.observes()` method takes two arguments; the first being the observer type as a string (such as `mutation`, `intersection`, or `resize`) and the second argument is the options passed to `observer.observe()`. Like event listeners, an observer will only connect if you've called `.then`. All in all, things would look more or less like:
```js
when(dialog).observes('resize')
    .then(() => { /* recalculate styles or whatever */ })
when(card).observes('intersection', {threshold: .5, root: document.body})
    .then(() => { /* fancy fade-in perhaps? */ })
when(myCustomElement).observes('mutation', {childList: true})
    .then(() => { /* do stuff */ })
```

<a name="chaining"></a>
## Chaining

### `.then()`

I'm just including this here for completeness sake; obviously, you get `then`. One thing that should be noted is that, unlike `then` in promises, the arguments you get in each `then` are always the same. You don't get the return value from the previous `then` in the next one (for things like event listeners, that would be kind of annoying anyway).

### `.only()`

Here, you get to filter the chain based on your specific conditions. It takes a callback, and will only fire then `.then()` handlers after it if the callback returned something truthy. The position of the `.only()` with respect to the `.then()` is therefore relevant; it will only filter out the `.then()`s _after_ the `.only()`. Here's an example:
```js
const button = document.createElement('button')
when(button).observers('mutation', {attributes: true})
    .then(() => console.log('an attribute changed!'))
    .only(([record]) => record.attributeName == 'hidden')
    .then(() => console.log('the "hidden" attribute changed!'))

button.toggleAttribute('hidden')
// an attribute changed!
// the "hidden" attribute changed!

button.setAttribute('data-foo', 'bar')
// an attribute changed!
```

### `.after()`

The thenable-ness of this syntax wouldn't be nearly as useful without `.after()`. It allows you to to run some code _after_ the `await` statement. The most common use-case for this is image loading. Usually, you'd want to attach the event listener, then set the `src`, and then wait for the `load` event to fire. Doing `await when(image).loads()` would therefore not work, because we'd have to set `src` before attaching the event listener (which means it could theoretically already be loaded by the time we attach the event handler). So, for this and similar cases, you get `.after()`. In code,
```js
when(image).loads()
    .after(() => image.src = 'cute-cats.png')
    .then(() => { /* draw on canvas */ })
```

### `.timeout()`

Sometimes, you'll want to use the await-able nature of `when` together with an event that may or may not fire. To avoid having unsettled promises lying around, you can chain into a call to `timeout`. If accepts one argument; the duration. Then, the `then` handler will be called either if the event fires, or if the timeout ended - whichever was first. Then event listener or observer will automatically disconnect after either the event or the timeout has fired. For example:
```js
await when(collapsible).transitionends().timeout(500)
collapsible.style.height = 'auto'
```
Calling `.timeout()` multiple times in the same chain does nothing; only the first one will actually attach a timeout (even if subsequent `timeout` would fire sooner).

### `.now()`

Occasionally you'll have some logic that should both run immediately and on subsequent events of a certain type. For that, you get `.now()`. This takes no argument, and essentially makes sure that any handler you add immediately gets invoked (synchronously). The `event` object won't be available for the first call when using `.now()` (it doesn't fire as a result of an event being dispatched, after all), instead, you'll just get `null`. Example usage:
```js
when(element).pointermoves().now().then(() => {
    updateDragPosition()
})
```
`.now()` will make sure both the handlers that have been attached before it was called as well as the ones after will be called. However, `.only()` can still stop this chain. For example:
```js
when(form).submits()
    .then(() => playLoadAnimation())
    .only(() => isValid(form))
    .then(() => postAndContinue(form))
    .now()

// when executed, plays loading animation, and if the form is
// already valid, posts it and continues. If the form is not valid,
// it will only immediately play the loading animation, then wait for
// the sumbit event.
```

### `.until()`

Although this `when` function is reversible, sometimes you want some nicer syntax to run some code and disconnect it at a certain point. For example, listen to keypresses in an input and stop listening when the user presses enter. You can do that like so:
```js
when(input).keydown()
    .then(() => updateValue(input.value))
    .until(event => event.key == 'Enter')
```
This will only detach the event handlers, so it will not stop the chain of `.then()`s like `.only()` does. However it will still respect `.only()`s that come before it, meaning it will not disconnect the event handlers if the `.only()`s in front of it don't pass.

Feel free to take a look at the source code, play around with it!
