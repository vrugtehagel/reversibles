# Reversibles

This tiny script provides you with a way to write _reversible functions_. That is to say, you can call a function, it will keep track of its (reversible) dependencies, give you an `undo` callback and so you can just... Undo everything you did with zero effort.

- [Usage](#usage)
- [Function signatures](#function-signatures)
- [Async reversibles (and `until`)](#async-reversibles)
- [Helper reversibles](#helper-reversibles)
- [Register other trackables (advanced)](#reversible-register)

<a name="usage"></a>
## Usage

This module gives you two functions: `reversible` and `until`. The former is the important one, so let's see an example of that first!
```js
const attachAutoComplete = reversible(input => {
    when(input).changes().then(() => autoComplete(input))
})

// call it in a non-reversible way:
attachAutoComplete(myInput)

// call it in a reversible way:
const {undo} = attachAutoComplete.do(myInput)
// and undo it! In this case, it detaches the 'change' event listener.
undo()
```
The first thing you might notice is the way the event listener is bound - that's not an `addEventListener`, what's up with that? Well, it's the reversible version of `addEventListener`. Or, _a_ reversible version. You can write your own! This `when` implementation can be found in the "library" folder, if you're interested. Anyway, that brings me to one of the key things about reversible functions; they can only ever undo their _reversible_ dependencies. It's all JavaScript, not magic, and so the `reversible` wrapper cannot see anything you do in your function unless it is also reversible. Yes, you could change the `EventTarget`'s prototype and overwrite `addEventListener` with a reversible version, but I refuse to touch prototypes. It's also probably a lot easier to maintain when there is a clear distinction between reversible functions and vanilla ones, but you're free to do whatever you like :wink:

<a name="function-signatures"></a>
## Function signatures

A function defined with `reversible` will retain its original signature. You can even still bind `this` to it. The function returned by `reversible` however also has a `do` method, which returns a "call object", exposing a way to undo a call. Parameters to `do` work as you'd expect, nothing changes relative to the original function in that respect. The return value is where it's at, and it looks like this:
```ts
interface ReversibleCall<T> {
    result: ReturnType<T>;
    undo: () => void;
    undone: boolean;
}
```
The `result` property simply contains the return value of the original function. If the reversible is asynchronous, `result` will be a promise. You also get the `undo` function, which takes no arguments, and returns nothing (i.e. it returns `undefined`). You may call it more than once, but it will only undo things the first time you call it. Lastly, and probably least important, you get a getter `undone` telling you whether the call has been undone or not. Note that destrucuring this property will just give you `false`, because you'd be immediately invoking the getter - keep a reference to the whole object around so you can check it like so:
```js
const foo = reversible(() => {
    // do reversible stuff
    return 23
})
const call = foo.do()
console.log(call.undone) // false
console.log(call.result) // 23
call.undo()
console.log(call.undone) // true
```

<a name="async-reversibles"></a>
## Async reversibles (and `until`)

You might want to write an asynchronous reversible function, because let's face it: `await` is awesome. I'm on your side here, and while this can't work straight out of the box, the module provides you with a function called `until` that makes things relatively easy. Synchronous reversibles rely on the synchronicity of the function to know when to track dependencies and when to stop, but `await` messes that up a bit. The `until` function should be wrapped around any awaited expression to help the function keep track of its dependencies. It looks somewhat like so:
```js
const uploadFile = reversible(async () => {
    const [fileHandle] = await until(window.showOpenFilePicker())
    const file = await until(fileHandle.getFile())
    // I also want to show off this syntax, because I think it's real nice
    // Let's assume we're submitting the file in a form
    await until(when(form).submits())
    console.log('Form submitted successfully!')
})
```
Note: do _not_ bake `until` into the return value of asynchronous functions, that won't work. Always write `await until(/* expression */)`.

As for undoing an asynchronous function, there's something you should keep in mind. Since you can call `undo` before the function has finished running, and aborting an async reversible early would mean creating a promise that will never be settled, the whole reversible will still be run every time you call it. Even when calling `undo` right away, it will wait for the call to finish running before starting to undo anything. It will however queue the undoing for when the reversible is done, so calling `.undo` early is still fine.

<a name="helper-reversibles"></a>
## Helper reversibles

There's an important distinction to make, that I have not brought up yet. You see, reversible functions only ever reverse their dependencies, but they don't know how to undo anything substantial. That's why we need _helper reversibles_, that are, in a way, at the end of the dependency chain. They are the ones that have to explicitly say how they should be undone. The event listening through `when` is an example of this; `when` explicitly defines how an event listener should be taken down. You can write these helper reversibles yourself; in fact, I encourage you to! The way to do this is fairly simple, so let's dive into an example.
```js
const test = reversible.define(number => {
    console.log(`Test ${number} ran!`)
    const undo = () => {
        console.log(`Test ${number} has been undone!`)
    }
    const result = `Test ${number}'s return value`
    return {result, undo}
})
```
The above helper reversible simply logs a message telling you when it has been run, and when it has been undone. The important part here is that you return an object with an `undo` method on it, that defines how to undo the function body. Don't worry about `undo`'s signature; it will be normalized (i.e. wrapped in another function, which returns `undefined` always). The return value of your function should be set in the `result` key. This is optional though; it will default to `undefined`, as you'd expect.

Note that this also means you _cannot_ write asynchronous helper reversibles; the return value needs to have the `undo` method, and asynchronous functions return a promise (which do not have that). You can still return a promise for the `result`, however. 

For some more examples for how to define helper reversibles, take a look at the "library" folder! Each example has a readme as well to explain what they do exactly.

<a name="reversibles-register"></a>
## Register other trackables (advanced)

The underlying mechanism for reversibles relies on tracking dependencies of functions. This script not only provides you with the reversibles themselves, but also that mechanism, allowing you to make functions that track other things as well. This is done by registering a key using `reversibles.register` and a registration object containing some methods that are needed to properly format the tracking. The key you provide will be the key you access on the `call` object returned by calling a function using `.do()`. In the case of reversibles, this key is called `undo`. Anyways, here's an example:
```js
reversible.register('foo', {
    bucket: () => new Set,
    add: (bucket, value) => bucket.add(value),
    combine: bucket => [...bucket].flat(),
    transform: value => value
})
```
These are the 4 methods. All are required, and you should not add additional properties or methods. There are two notions here; the `bucket` and the `value`. The `value` is the thing you eventually access on the `call` object, in the above example, the value, `call.foo`, is an array. The `bucket` is the internal mechanism that's keeping track of the dependencies of a call. In the above example, we've chosen this to be a `Set`, but you could also use an array, or anything else. The `bucket` method in the registration should return an empty bucket. The `add` method then adds a value to the bucket. The `combine` method takes a bucket of values, and returns a value that is an accumulation of all the values in the bucket. In the above example, our `value`s are arrays, and the `combine` method takes a bucket (a `Set`) of `value` arrays, and merges them into a single array. Lastly, the `transform` method allows you to transform a value returned by `reversible.define` into something else. In the case of `reversible` itself, this `transform` method is used to transform the `undo` function into one that can only be called once. Specifically, `reversible` itself is implemented like so:
```js
reversible.register('undo', {
    bucket: () => [],
    add: (bucket, undo) => bucket.unshift(undo),
    combine: bucket => () => bucket.forEach(undo => undo()),
    transform: undo => {
        let undone = false
        return () => {
            if(undone) return
            undone = true
            undo()
        }
    }
})
``` 
If supporting async functions with your trackable functions as a concern, you should make sure that the `value` for your key is a function. This is because async functions can resolve later, and to make sure all dependencies have been caught, we need to wait until the function has resolved. If the `value` is not a function, there is no way to properly wait for the dependencies to be tracked.
