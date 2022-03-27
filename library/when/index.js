import { reversible } from '../../index.js'

const getChainable = (attach, detach) => {
    const handlers = []
    let timeoutId
    let doNow = false
    const fn = (...args) => {
        clearTimeout(timeoutId)
        for(const handler of handlers)
            if(handler(...args)) return
        if(timeoutId) undo()
    }
    const after = callback => {
        queueMicrotask(() => queueMicrotask(callback))
        return result
    }
    const now = () => {
        doNow = true
        fn(null)
        return result
    }
    const only = handler => {
        if(doNow) doNow = handler(null)
        handlers.push((...args) => !handler(...args))
        return result
    }
    const timeout = duration => {
        timeoutId ??= setTimeout(() => fn(null), duration)
        return result
    }
    const then = handler => {
        handlers.push((...args) => { handler(...args) })
        if(doNow) handler(null)
        if(handlers.length == 1) attach(fn)
        return result
    }
    const undo = () => detach(fn)
    const result = {after, now, only, timeout, then}
    return {undo, result}
}

export default function when(target){
    const does = reversible.define((type, options) => {
        const attach = fn => target.addEventListener(type, fn, options)
        const detach = fn => target.removeEventListener(type, fn, options)
        return getChainable(attach, detach)
    })

    const observes = reversible.define((type, options = {}) => {
        const name = type[0].toUpperCase() + type.slice(1).toLowerCase()
        const Observer = globalThis[name + 'Observer']
        if(!Observer) return
        let observer
        const attach = fn => {
            observer = new Observer(fn)
            observer.observe(target, options)
        }
        const detach = () => observer.disconnect()
        return getChainable(attach, detach)
    })

    const get = (source, property) => {
        if(property == 'does') return does
        if(property == 'observes' && target instanceof Node) return observes
        const type = when.keepS ? property : property.replace(/s$/, '')
        return options => does(type, options)
    }
    return new Proxy({does: () => {}, observes: () => {}}, {get})
}
