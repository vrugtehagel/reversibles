import { assert } from "https://deno.land/std@0.132.0/testing/asserts.ts";
import { reversible, until } from '../index.js'

const calls = {
    foo: {do: 0, undo: 0, args: []},
    bar: {do: 0, undo: 0}
}
const reset = () => {
    for(const key of Object.keys(calls))
        calls[key] = {do: 0, undo: 0}
    calls.foo.args = []
}
const foo = reversible.define((...args) => {
    calls.foo.do++
    calls.foo.args = args
    const undo = () => {
        calls.foo.undo++
    }
    const result = args.join(',')
    return {undo, result}
})
const bar = reversible.define(() => {
    calls.bar.do++
    let id = 0
    const result = new Promise(resolve => {
        id = setTimeout(() => resolve('bonjour'), 20)
    })
    const undo = () => {
        calls.bar.undo++
        clearTimeout(id)
    }
    return {result, undo}
})
const baz = reversible((start, end) => {
    const string = foo(1, 2, 3)
    return string.slice(start, end)
})


Deno.test('a helper reversible acts like a normal function', () => {
    const result = foo('arg1', 'arg2')
    assert(calls.foo.args.length == 2)
    assert(calls.foo.args[0] == 'arg1')
    assert(calls.foo.args[1] == 'arg2')
    assert(calls.foo.do == 1)
    assert(calls.foo.undo == 0)
    assert(result == 'arg1,arg2')
    reset()
})
Deno.test('a helper reversible can be undone when called with .do()', () => {
    const call = foo.do('arg1', 'arg2')
    assert(call.result == 'arg1,arg2')
    assert(call.undone == false)
    assert(calls.foo.do == 1)
    assert(calls.foo.undo == 0)
    call.undo()
    assert(call.undone == true)
    assert(calls.foo.do == 1)
    assert(calls.foo.undo == 1)
    call.undo()
    assert(calls.foo.undo == 1)
    reset()
})
Deno.test('a reversible acts like a normal function', () => {
    const result = baz(1, -1)
    assert(result == ',2,')
    assert(calls.foo.args.toString() == '1,2,3')
    assert(calls.foo.do == 1)
    assert(calls.foo.undo == 0)
    reset()
})
Deno.test('a reversible can be undone when called with .do()', () => {
    const call = baz.do(1, -1)
    assert(call.result == ',2,')
    assert(call.undone == false)
    assert(calls.foo.do == 1)
    assert(calls.foo.undo == 0)
    call.undo()
    assert(call.undone == true)
    assert(calls.foo.do == 1)
    assert(calls.foo.undo == 1)
    call.undo()
    assert(calls.foo.undo == 1)
    reset()
})
Deno.test('a reversible can be nested', () => {
    const qux = reversible(() => baz(1, -1))
    const result = qux()
    assert(result == ',2,')
    assert(calls.foo.args.toString() == '1,2,3')
    assert(calls.foo.do == 1)
    assert(calls.foo.undo == 0)
    reset()
})
Deno.test('an async helper reversible can be reversed', async () => {
    const call = bar.do()
    const result = await call.result
    assert(result == 'bonjour')
    assert(call.undone == false)
    assert(calls.bar.do == 1)
    assert(calls.bar.undo == 0)
    call.undo()
    assert(call.undone == true)
    assert(calls.bar.do == 1)
    assert(calls.bar.undo == 1)
    reset()
})
Deno.test('an async reversible can be reversed', async () => {
    const qux = reversible(async () => {
        await until(new Promise(resolve => setTimeout(resolve, 20)))
        return baz(1, -1)
    })
    const call = qux.do()
    const result = await call.result
    assert(result == ',2,')
    assert(call.undone == false)
    assert(calls.foo.do == 1)
    assert(calls.foo.undo == 0)
    await call.undo()
    assert(call.undone == true)
    assert(calls.foo.do == 1)
    assert(calls.foo.undo == 1)
    reset()
})
Deno.test('an async reversible can be nested', async () => {
    const qux = reversible(async () => {
        await until(bar())
        foo(1, 2, 3)
        return 23
    })
    const call = qux.do()
    const result = await call.result
    assert(result == 23)
    assert(calls.foo.args.toString() == '1,2,3')
    assert(calls.foo.do == 1)
    assert(calls.foo.undo == 0)
    assert(calls.bar.do == 1)
    assert(calls.bar.undo == 0)
    await call.undo()
    assert(calls.foo.do == 1)
    assert(calls.foo.undo == 1)
    assert(calls.bar.do == 1)
    assert(calls.bar.undo == 1)
    reset()
})
Deno.test('a reversible maintains (a)synchronicity', () => {
    const sync = reversible(() => {})
    const async = reversible(async () => {})
    assert(sync.constructor.name == 'Function')
    assert(async.constructor.name == 'AsyncFunction')
    reset()
})
Deno.test('reversibles retain the "this" value', () => {
    let context = null
    const qux = reversible(function(){
        context = this
    })
    qux()
    assert(context == this)
    const object = {method: qux}
    object.method()
    assert(context == object)
    object.method.call(23)
    assert(context == 23)
})