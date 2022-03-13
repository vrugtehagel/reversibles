let current = null

const create = (doable, isAsync) => {
    const fn = isAsync
        ? async function(...args){ return doable.apply(this, args).result }
        : function(...args){ return doable.apply(this, args).result }
    fn.do = function(...args){
        const call = this == fn ? doable(...args) : doable.apply(this, args)
        const {result} = call
        let undone = false
        const undo = () => {
            if(undone) return
            undone = true
            call.undo()
        }
        return {result, undo, get undone(){ return undone }}
    }
    return fn
}

const asyncReversible = definition => function(...args){
    const context = current
    const dependencies = []
    current = dependencies
    const promise = definition.apply(this, args)
    current = context
    const result = promise.then(result => {
        context?.unshift(undo)
        current = context
        return result
    })
    const undo = () => promise.then(() => dependencies.forEach(undo => undo()))
    return {result, undo}
}

const syncReversible = definition => function(...args){
    const context = current
    const dependencies = []
    current = dependencies
    const result = definition.apply(this, args)
    const undo = () => dependencies.forEach(undo => undo())
    context?.unshift(undo)
    current = context
    return {result, undo}
}

reversible.define = definition => create(function(...args){
    const response = definition.apply(this, args)
    const {result, undo} = response
    current?.unshift(undo)
    return {result, undo}
})

export function reversible(fn){
    const isAsync = fn.constructor.name == 'AsyncFunction'
    return create(isAsync ? asyncReversible(fn) : syncReversible(fn), isAsync)
}

export async function until(promise){
    const context = current
    current = null
    const then = resolve => {
        return promise.then(result => {
            current = context
            return resolve(result)
        })
    }
    return {then}
}
