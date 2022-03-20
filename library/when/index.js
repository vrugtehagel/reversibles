import { reversible } from '../../index.js'

const doEach = fns => (...args) => fns.forEach(fn => fn(...args))

export default function when(target){
    const does = reversible.define((type, options) => {
        const handlers = []
        let fn
        let doNow = false
        const after = callback => {
            queueMicrotask(() => queueMicrotask(callback))
            return {then, timeout}
        }
        const timeout = async duration => ({then: resolve => {
            const stop = result => {
                clearTimeout(timeoutId)
                target.removeEventListener(type, stop, options)
                resolve(result)
            }
            const timeoutId = setTimeout(() => stop(null), duration)
            target.addEventListener(type, stop, options)
        }})
        const then = handler => {
            handlers.push(handler)
            if(doNow) handler(null)
            if(handlers.length > 1) return
            fn = doEach(handlers)
            target.addEventListener(type, fn, options)
            return {then}
        }
        const now = () => {
            doNow = true
            return {then, after}
        }
        const undo = () => target.removeEventListener(type, fn, options)
        const result = {now, then, after, timeout}
        return {undo, result}
    })

    const observes = reversible.define((type, options = {}) => {
        const name = type[0].toUpperCase() + type.slice(1).toLowerCase()
        const Observer = globalThis[name + 'Observer']
        if(!Observer) return
        let observer
        const handlers = []
        const then = handler => {
            handlers.push(handler)
            if(handlers.length > 1) return
            observer = new Observer(doEach(handlers))
            observer.observe(target, options)
            return {then}
        }
        const undo = () => observer.disconnect()
        const result = {then}
        return {undo, result}
    })

    const get = (source, property) => {
        if(property == 'does') return does
        if(property == 'observes' && target instanceof Node) return observes
        const type = property.replace(/s$/, '')
        return options => does(type, options)
    }
    return new Proxy({does: () => {}, observes: () => {}}, {get})
}
