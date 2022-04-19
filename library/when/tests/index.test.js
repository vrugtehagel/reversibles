import { assert, unreachable } from "https://deno.land/std@0.132.0/testing/asserts.ts";
import when from '../index.js'

class MagicObserver {
    static trigger = () =>
        this.#active.forEach(observer => observer.trigger())
    static #active = new Set()
    #callback = null
    #targets = []
    constructor(callback){
        this.#callback = callback
    }
    observe(target){
        this.#targets.push(target)
        MagicObserver.#active.add(this)
    }
    disconnect(){
        this.#targets = []
        MagicObserver.#active.delete(this)
    }
    trigger(){
        this.#targets.forEach(target => this.#callback(target))
    }
}

Deno.test('works with regular events', () => {
    let calls = 0
    const target = new EventTarget
    when(target).does('fire').then(() => calls++)
    target.dispatchEvent(new CustomEvent('fire'))
    assert(calls == 1)
})
Deno.test('works with regular events with shorthand', () => {
    let calls = 0
    const target = new EventTarget
    when(target).fires().then(() => calls++)
    target.dispatchEvent(new CustomEvent('fire'))
    assert(calls == 1)
})
Deno.test('works with regular events with shorthand (strict)', () => {
    when.strict = true
    let calls = 0
    const target = new EventTarget
    when(target).fire().then(() => calls++)
    when(target).fires().then(unreachable)
    target.dispatchEvent(new CustomEvent('fire'))
    assert(calls == 1)
    when.strict = false
})
Deno.test('takes options argument properly', () => {
    let calls = 0
    const target = new EventTarget
    when(target).fires({once: true}).then(() => calls++)    
    assert(calls == 0)
    target.dispatchEvent(new CustomEvent('fire'))
    assert(calls == 1)
    target.dispatchEvent(new CustomEvent('fire'))
    assert(calls == 1)
})
Deno.test('is awaitable', async () => {
    const target = new EventTarget
    setTimeout(() => target.dispatchEvent(new CustomEvent('fire')), 20)
    await when(target).fires()
})
Deno.test('is reversible', () => {
    let calls = 0
    const target = new EventTarget
    const fire = when(target).does.do('fire')
    fire.result.then(() => calls++)
    target.dispatchEvent(new CustomEvent('fire'))
    assert(calls == 1)
    fire.undo()
    target.dispatchEvent(new CustomEvent('fire'))
    assert(calls == 1)
})
Deno.test('.timeout()', async () => {
    let calls = 0
    const target = new EventTarget
    await when(target).fires()
        .then(() => calls++)
        .timeout(20)
    assert(calls == 1)
    target.dispatchEvent(new CustomEvent('fire'))
    assert(calls == 1)
    setTimeout(() => target.dispatchEvent(new CustomEvent('fire')), 20)
    const time = Date.now()
    await when(target).fires()
        .timeout(1000)
    assert(Date.now() - time < 500)
})
Deno.test('.only()', () => {
    let calls = 0
    const target = new EventTarget
    const event = new CustomEvent('fire', {detail: 23})
    when(target).fires()
        .only(event => event.detail == null)
        .then(unreachable)
    when(target).fires()
        .only(event => event.detail == 23)
        .then(() => calls++)
    target.dispatchEvent(event)
    assert(calls == 1)
})
Deno.test('.after()', async () => {
    const target = new EventTarget
    const trigger = () =>
        target.dispatchEvent(new CustomEvent('fire'))
    await when(target).fires()
        .after(() => trigger())
})
Deno.test('.now()', () => {
    let calls = 0
    let moreCalls = 0
    const target = new EventTarget
    when(target).fires()
        .then(() => calls++)
        .now()
        .then(() => moreCalls++)
    assert(calls == 1)
    assert(moreCalls == 1)
    target.dispatchEvent(new CustomEvent('fire'))
    assert(calls == 2)
    assert(moreCalls == 2)
})
Deno.test('.until()', () => {
    let calls = 0
    const target = new EventTarget
    when(target).fires()
        .then(() => calls++)
        .until(() => calls == 2)
    target.dispatchEvent(new CustomEvent('fire'))
    target.dispatchEvent(new CustomEvent('fire'))
    assert(calls == 2)
    target.dispatchEvent(new CustomEvent('fire'))
    assert(calls == 2)
})
Deno.test('chains all the chains', async () => {
    let calls = 0
    let moreCalls = 0
    const target = new EventTarget
    const trigger = detail =>
        target.dispatchEvent(new CustomEvent('fire', {detail}))
    const thennable = when(target).fires()
        .now()
        .after(() => trigger(23))
        .then(() => calls++)
        .only(event => event?.detail == 23)
        .then(() => moreCalls++)
    assert(calls == 1)
    assert(moreCalls == 0)
    await thennable
    assert(calls == 2)
    assert(moreCalls == 1)
    trigger()
    assert(calls == 3)
    assert(moreCalls == 1)
})

Deno.test('observers', () => {
    let calls = 0
    globalThis['MagicObserver'] = MagicObserver
    when({foo: 'bar'}).observes('magic')
        .then(() => calls++)
        .now()
    assert(calls == 1)
    MagicObserver.trigger()
    assert(calls == 2)
    delete globalThis['MagicObserver']
})
