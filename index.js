let current = {}

export function reversible(definition){
    const async = definition.constructor.name == 'AsyncFunction'
    return reversible.define(function(...args){
        const before = {...current}
        current = {}
        const tracking = {}
        if(async) for(const [key, {bucket}] of Object.entries(registry))
            current[key] = tracking[key] = bucket()
        const result = definition.apply(this, args)
        const call = {result}
        if(async) for(const [key, {combine}] of Object.entries(registry))
            call[key] = () => result.then(combine(tracking[key]))
        else for(const [key, tracking] of Object.entries(current))
            call[key] = registry[key].combine(tracking)
        current = before
        return call
    }, {async})
}

reversible.define = (definition, {async} = {}) => {
    const doable = function(...args){
        const {result, ...things} = definition.apply(this, args)
        for(const [key, value] of Object.entries(things))
            registry[key].add(current[key] ||= registry[key].bucket(), value)
        return {result, ...things}
    }
    const fn = async
        ? async function(...args){ return doable.apply(this, args).result }
        : function(...args){ return doable.apply(this, args).result }
    fn.do = function(...args){
        const {result, ...things} = this == fn ? doable(...args) : doable.apply(this, args)
        const transformedCall = {result}
        const empty = key => registry[key].combine(registry[key].bucket())
        for(const [key, {transform}] of Object.entries(registry))
            transformedCall[key] = transform(things[key] || empty(key))
        return transformedCall
    }
    return fn
}

export async function until(promise){
    const before = {...current}
    current = {}
    const then = resolve => promise.then(result => {
        current = before
        return resolve(result)
    })
    return {then}
}

reversible.register = (name, registration) => {
    if(name == 'result') return
    registry[name] ??= registration
}

const registry = {
    undo: {
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
    }
}
