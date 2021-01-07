const textDecoder = new TextDecoder('utf-8')
const textEncoder = new TextEncoder()

// /**
//  * @param {Array|Uint32Array|Uint8Array} array
//  */
// export function countUntilZero(array) {
// 	let i = 0
// 	while (i < array.length && array[i] !== 0) i++
// 	return i
// }

/**
 * @param {Uint8Array} mem
 * @param {number} startPtr
 * @param {number|undefined} [len]
 */
export function getString(mem, startPtr, len) {
	let endPtr = startPtr
	if (len === undefined) {
		while (endPtr < mem.length && mem[endPtr] !== 0) endPtr++
	} else {
		endPtr += len
	}
	return textDecoder.decode(new Uint8Array(mem.buffer, startPtr, endPtr - startPtr))
}

/**
 * @param {Uint8Array} mem
 * @param {number} destPtr
 * @param {string} str
 */
export function putString(mem, destPtr, str) {
	const n = textEncoder.encodeInto(str, new Uint8Array(mem.buffer, destPtr)).written ?? 0
	mem[destPtr + n] = 0
	return n + 1
}

/**
 * @param {Uint8Array} mem
 * @param {number} formatPtr
 * @param {number} argsPtr
 */
export function simpleSprintf(mem, formatPtr, argsPtr) {
	const format = getString(mem, formatPtr)
	const args = new Uint32Array(mem.buffer, argsPtr)
	let argsUsed = 0
	return format.replace(/(.?)%([^%])/g, (_, prefix, suffix) => {
		if (prefix === '%') return '%%'
		const arg = args[argsUsed++]
		switch (suffix) {
			case 's':
				return prefix + getString(mem, arg)
			case 'd':
				return prefix + arg
			default:
				return prefix + `<!FMT:${suffix}:${arg}!>`
		}
	})
}

/**
 * @param {Uint8Array} mem
 * @param {number} bufPtr
 * @param {number} formatPtr
 * @param {number} argsPtr
 */
export function simpleSscanf(mem, bufPtr, formatPtr, argsPtr) {
	let buf = getString(mem, bufPtr)
	const format = getString(mem, formatPtr)
	const args = new Uint32Array(mem.buffer, argsPtr)
	let argsUsed = 0
	let valuesFilled = 0

	const m = format.match(/%./g)
	if (!m) return 0
	for (const item of m) {
		const fmt = item.substr(1)
		const arg = args[argsUsed++]
		switch (fmt) {
			case 'f': {
				const m = /[+\-]?\d+(?:\.\d*)?/.exec(buf)
				if (!m) return valuesFilled
				buf = buf.slice(m.index + m[0].length)
				new Float32Array(mem.buffer, arg)[0] = parseFloat(m[0])
				valuesFilled++
				break
			}
			case 'd': {
				const m = /[+\-]?\d+/.exec(buf)
				if (!m) return valuesFilled
				buf = buf.slice(m.index + m[0].length)
				new Uint32Array(mem.buffer, arg)[0] = parseInt(m[0])
				valuesFilled++
				break
			}
			case 'c':
				if (buf.length === 0) return valuesFilled
				mem[arg] = buf.charCodeAt(0)
				buf = buf.slice(1)
				valuesFilled++
				break
			default:
				throw new Error(`can not scan '${item}' in '${format}'`)
		}
	}
	return valuesFilled
}
