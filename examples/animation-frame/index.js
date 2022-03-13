import { reversible } from '../../index.js'

export default reversible.define(({repeat} = {}) => {
	let id = -1
	const callbacks = []
	const then = callback => {
		callbacks.push(callback)
		if(id != -1) return {then}
		const frame = () => {
			id = requestAnimationFrame((...args) => {
				callbacks.forEach(callback => callback(...args))
				if(repeat) frame()
			})
		}
		frame()
		return {then}
	}
	const undo = () => {
		cancelAnimationFrame(id)
		id = -1
	}
	const result = {then}
	return {undo, result}
})
