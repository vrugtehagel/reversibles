import { reversible } from '../../index.js'

export default reversible.define((duration, {repeat} = {}) => {
    const callbacks = []
    let id = -1
    const then = callback => {
        callbacks.push(callback)
        if(id != -1) return {then}
        const schedule = repeat ? setInterval : setTimeout
        id = schedule(() => callbacks.forEach(callback => callback()), duration)
        return {then}
    }
    const undo = () => {
        clearTimeout(id)
        id = -1
    }
    const result = {then}
    return {undo, result}
})
