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
```
These are all a tad different. For one, observers have little to do with event listeners; they act on elements, not event targets (elements happen to also be event targets, but that's irrelevant). Let's look at the possiblilities.


## Event listeners

For these, `when` expects one argument, an `EventTarget`. Then, you can call `.does()` on it, with either one or two arguments. The first is the event type (e.g. 'load', 'change', 'click') and the second, optional argument will be passed as third argument to `addEventListener`. This way, you can use things like `passive` or `once`. That `.does()` call then returns a 'thenable', i.e. an object with a `then` method on it. That `then` method takes a callback (as you guessed) which receives one argument; the `event` object. Those `then`s are chainable, and because it's a thenable, it means you can `await` them as well. Also, only after having called `then` on that will an event listener actually be added. That means that something like `when(window).does('load')` actually doesn't do anything, and will not create event listeners. Note that `await when(window).does('load')` will, because `await` is syntactic sugar that calls `then` under the hood. All in all, you get this:
```js
when(eventTarget).does(eventType, options)
    .then(event => { /* stuff */ })
    .then(event => { /* more stuff */ })
```

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

### .after()

The thenable-ness of this syntax wouldn't be nearly as useful without `.after()`. It allows you to to run some code _after_ the `await` statement. The most common use-case for this is image loading. Usually, you'd want to attach the event listener, then set the `src`, and then wait for the `load` event to fire. Doing `await when(image).loads()` would therefore not work, because we'd have to set `src` before attaching the event listener (which means it could already be loaded by the time we attach the event handler). So, for this and similar cases, you get `.after()`. It is only chainable from a `.does` (or a shorthand for it), not a `.then`. Basically, write your `.after` before any `.then`s, like so:
```js
await when(image).loads()
    .after(() => image.src = 'cute-cats.png')
```
Note that you can still chain `.then`s from an `.after()`, just not the other way around.

## Observers

Observers, like `MutationObserver`, `IntersectionObserver` and `ResizeObserver` are a good fit for this syntax as well. These are a bit less common, so they don't have a shorthand. They all work through `.observes()` rather than `.does()` - additionally, they require the argument to `when` to be an element, as it will be passed to the observer. The `.observes()` method takes two arguments; the first being the observer type (such as `mutation`, `intersection`, or `resize`) and the second argument is the options passed to `observer.observe()`. Again, an observer will only connect if you've called `.then`. All in all, things would look along the lines of
```js
when(dialog).observes('resize')
    .then(() => { /* recalculate styles or whatever */ })
when(card).observes('intersection', {threshold: .5, root: document.body})
    .then(() => { /* fancy fade-in perhaps? */ })
when(myCustomElement).observes('mutation', {childList: true})
    .then(() => { /* do stuff */ })
```
