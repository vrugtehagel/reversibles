# Reversibles

This tiny script provides you with a way to write _reversible functions_. That is to say, you can call a function, it will keep track of its (reversible) dependencies, and give you an `undo` callback so you can just... Undo everything you did with zero effort. Here's a snippet:

## Usage
This module gives you two functions: `reversible` and `until`. We'll focus on `reversible` for now, but first, let's see an example!
```js
const attachAutoComplete = reversible(input => {
	when(input).changes().then(() => autoComplete(input))
})

// call it in a non-reversible way:
attachAutoComplete(myInput)

// call it in a reversible way:
const {undo} = attachAutoComplete.do(myInput)
// and undo it! In this case, it detaches the event listener.
undo()
```
The first thing you might notice is the way the event listener is bound - that's not an `addEventListener`, what's up with that? Well, it's the reversible version of `addEventListener`. Or, _a_ reversible version. You can write your own! This `when` implementation can be found in the "examples" folder, if your interested. Anyway, that brings me to one of the key things about reversible functions; they can only ever undo their reversible dependencies. It's all JavaScript, not magic, and so the `reversible` wrapper cannot see anything you do in your function unless it is also reversible. Yes, you could change the `EventTarget`'s prototype and overwrite `addEventListener` with a reversible version, but I refuse to touch prototypes. It's also probably a lot easier to maintain when there is a clear distinction between reversible functions and vanilla ones, but you're free to do whatever you like :wink:

## Function signatures

A function defined with `reversible` will retain its original signature. You can even still bind `this` to it. The function returned by `reversible` however also has a `do` property, which exposes a way to undo a call. Parameters work as you'd expect, nothing changes relative to the original function. The return value is where it's at, and it looks like this:
```ts
interface ReversibleCall<T> {
	result: ReturnType<T>;
	undo: () => void;
	undone: boolean;
}
```
The `result` property simply contains the return value of the original function. If the reversible is asynchronous, `result` will be a promise. You also get the `undo` function, which takes no arguments, and returns nothing. You may call it more than once, but it will only undo things the first time you call it. Lastly, and probably least importantly, you get a getter `undone` telling you whether the call has been undone or not. Note that destrucuring this property will just give you `false`, because you'd be immediately invoking the getter - keep a reference to the whole object around so you can check it like so:
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

## Async reversibles

You might want to write an asynchronous reversible function, because let's face it: `await` is awesome. I'm on your side here, and this can't work straight out of the box, the module provides you with a function called `until` that makes things relatively easy. Synchronous reversibles rely on the synchronicity of the function to know when to track dependencies and when to stop, but `await` messes that up a bit. The `until` function should be wrapped around any awaited expression to help the function keep track of its dependencies. It looks somewhat like so:
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

As for undoing an asynchronous function, it works a tad different. Since you can call `undo` before the function has finished running, and aborting an async reversible early would mean creating a promise that will never be settled, the whole reversible will be run every call. Even when calling `undo` right away, it will wait for the call to finish running before starting to undo anything.

## Helper reversibles

There's an important distinction to make, that I have not brought up before. You see, `reversible` only every reverse their dependencies, but they don't know how to undo anything substantial. That's why we need _helper reversibles_, that are, in a way, at the end of the dependency chain. They are the ones that have to explicitly say how they should be undone. The event listening through `when` is an example of this; `when` explicitly defines how an event listener should be taken down. You can write these helper reversibles yourself; in fact, I encourage you to! The way to do this is fairly simple, so let's dive into an example.
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
