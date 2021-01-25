import { JCS_CMYK, JCS_YCbCr, JCS_YCCK } from './const.js'
import { JCS_EXT_RGBA } from './const.js'
import { getString, putString, simpleSprintf, simpleSscanf } from './utils.js'

export * from './const.js'

const stdoutPtr = 1
const stderrPtr = 2
const outImgFilePtr = 10042

/** @typedef {number} Pointer */

/** @typedef {import('./const').JCS_GRAYSCALE | import('./const').JCS_RGB | import('./const').JCS_YCbCr | import('./const').JCS_CMYK | import('./const').JCS_YCCK} OutColorSpace */
/** @typedef {import('./const').JCS_GRAYSCALE | import('./const').JCS_RGB | import('./const').JCS_YCbCr | import('./const').JCS_CMYK | import('./const').JCS_YCCK | import('./const').JCS_EXT_RGB | import('./const').JCS_EXT_BGR | import('./const').JCS_EXT_RGBA | import('./const').JCS_EXT_BGRA | import('./const').JCS_EXT_ABGR | import('./const').JCS_EXT_ARGB} InColorSpace */

/**
 * @typedef {Object} MozJPEG
 * @prop {WebAssembly.Instance} instance
 * @prop {WebAssembly.Memory} memory
 * @prop {(start:Pointer, length:number) => Uint8Array} getMemoryUint8View
 * @prop {(start:Pointer, length:number) => void} onImgChunk
 * @prop {(width:number, height:number, in_color_space:InColorSpace, channels:number) => Pointer} init_compress
 * @prop {(value:OutColorSpace) => void} cinfo_set_out_color_space
 * @prop {(value:number) => void} cinfo_set_quant_table
 * @prop {(value:boolean) => void} cinfo_set_optimize_coding
 * @prop {(value:number) => void} cinfo_set_smoothing_factor
 * @prop {(num_loops:number, use_multipass:boolean, optimize_zero_blocks:boolean, optimize_table:boolean) => void} cinfo_set_trellis
 * @prop {(luma_quality:number, chroma_quality:number) => void} cinfo_set_quality
 * @prop {(h_samp_factor:number, v_samp_factor:number) => void} cinfo_set_chroma_subsample
 * @prop {() => void} cinfo_disable_progression
 * @prop {() => void} start_compress
 * @prop {() => boolean} write_scanlines
 * @prop {() => void} finish_compress
 */

/**
 * @typedef {Object} ModuleOptions
 * @prop {((msg:string) => unknown)|null} [onStdout=console.warn]
 * @prop {((msg:string) => unknown)|null} [onStderr=console.error]
 * @prop {((newPages:number, totalBytes:number, lastAllocBytes:number) => unknown)|null} [opts.onMemGrow]
 */

/**
 * @param {ModuleOptions|null} [opts]
 * @returns {Promise<MozJPEG>}
 */
export function loadWebModule(opts) {
	return loadModule(importObject => {
		const filepath = new URL('mozjpeg.wasm', import.meta.url).pathname
		return WebAssembly.instantiateStreaming(fetch(filepath), importObject)
	}, opts)
}

/**
 * @typedef {{promises:{readFile(fpath:string):Promise<Buffer>}}} ReadableFS
 * @param {Promise<ReadableFS> | ReadableFS} fs
 * @param {ModuleOptions|null} [opts]
 * @returns {Promise<MozJPEG>}
 */
export function loadNodeModule(fs, opts) {
	return loadModule(async importObject => {
		const filepath = new URL('mozjpeg.wasm', import.meta.url).pathname
		return WebAssembly.instantiate(await (await fs).promises.readFile(filepath), importObject)
	}, opts)
}

/**
 * @param {(importObject:Object) => Promise<WebAssembly.WebAssemblyInstantiatedSource>} loadFunc
 * @param {ModuleOptions|null} [opts]
 * @returns {Promise<MozJPEG>}
 */
export async function loadModule(loadFunc, opts) {
	opts ??= {}
	const onStdout = opts.onStdout ?? console.warn
	const onStderr = opts.onStdout ?? console.error
	const onMemGrow = opts.onMemGrow

	let lastStderrMsg = /** @type {string|null} */ (null)
	function onPrint(filePtr, string) {
		if (filePtr === stdoutPtr) {
			onStdout(string)
		} else if (filePtr === stderrPtr) {
			lastStderrMsg = string
			onStderr(string)
		} else throw new Error(`wrong print file: ${filePtr}`)
	}

	const importObject = {
		env: {
			exit(code) {
				throw new Error(
					`WASM terminated with exit(${code})` +
						(lastStderrMsg === null ? '' : ' after: ' + lastStderrMsg),
				)
			},
			fwrite(bufPtr, size, count, streamPtr) {
				// console.log('fwrite', arguments)
				if (streamPtr === outImgFilePtr) mozJpeg.onImgChunk(bufPtr, count * size)
				else onPrint(streamPtr, getString(memBuf, bufPtr, count * size))
				return count
			},
			fiprintf(fdPtr, formatPtr, argsPtr) {
				// console.log('fiprintf', arguments, getString(memBuf, formatPtr))
				onPrint(fdPtr, simpleSprintf(memBuf, formatPtr, argsPtr))
				return 0
			},
			fputc() {
				console.error('fputc', arguments)
				throw new Error('not implemented')
			},
			fflush() {
				// console.log('fflush', arguments)
				return 0
			},
			ferror() {
				// console.log('ferror', arguments)
				return 0
			},
			siprintf(strPtr, formatPtr, argsPtr) {
				// console.log('siprintf', arguments, getString(memBuf, formatPtr))
				const str = simpleSprintf(memBuf, formatPtr, argsPtr)
				return putString(memBuf, strPtr, str)
			},
			sscanf(bufPtr, formatPtr, argsPtr) {
				// console.log('sscanf', arguments)
				return simpleSscanf(memBuf, bufPtr, formatPtr, argsPtr)
			},
			math_pow: Math.pow,
			after_memory_grow(newPages, lastAllocSize) {
				memBuf = new Uint8Array(memory.buffer)
				if (onMemGrow) onMemGrow(newPages, memBuf.length, lastAllocSize)
			},

			// // ===
			// fprintf(fdPtr, formatPtr, argsPtr) {
			// 	console.log('fprintf', arguments, new Uint32Array(mem.buffer, arguments[2], 2))
			// 	importObject.env.fiprintf(fdPtr, formatPtr, argsPtr)
			// },
			// sprintf() {
			// 	console.log('sprintf', arguments)
			// },
			// pow() {
			// 	console.log('pow', arguments)
			// },
			// realloc() {
			// 	console.log('realloc', arguments)
			// },
			// setTempRet0() {
			// 	console.log('setTempRet0', arguments)
			// },
		},
	}

	const { instance } = await loadFunc(importObject)
	const exports = instance.exports
	const memory = /** @type {WebAssembly.Memory} */ (exports.memory)
	let memBuf = new Uint8Array(memory.buffer)

	function getMemoryUint8View(start, length) {
		return new Uint8Array(memory.buffer, start, length)
	}

	const mozJpeg = /** @type {MozJPEG} */ ({ instance, memory, getMemoryUint8View })
	for (const attr in exports) if (typeof exports[attr] === 'function') mozJpeg[attr] = exports[attr]
	return mozJpeg
}

/**
 * @typedef {{startPtr:Pointer, length:number}} BufferLocation
 */

/**
 * @param {MozJPEG} mozJpeg
 * @param {number} w
 * @param {number} h
 * @param {InColorSpace} inColorSpace
 * @param {number} channels
 * @returns {{rowBufLocation:BufferLocation, imgChunks:ArrayBuffer[]}}
 */
export function initCompressSimple(mozJpeg, w, h, inColorSpace, channels) {
	const imgChunks = /** @type {ArrayBuffer[]} */ ([])
	mozJpeg.onImgChunk = (start, length) => imgChunks.push(mozJpeg.memory.buffer.slice(start, start + length))

	const rowBufPtr = mozJpeg.init_compress(w, h, inColorSpace, channels)
	const rowBufLocation = { startPtr: rowBufPtr, length: w * channels }

	return { rowBufLocation, imgChunks }
}

/**
 * @param {MozJPEG} mozJpeg
 * @param {BufferLocation} rowBufLocation
 * @param {Uint8Array|Uint8ClampedArray} pixBuf
 * @param {number} h
 * @param {number} rowStride
 * @returns {void}
 */
export function writeRowsSimple(mozJpeg, rowBufLocation, pixBuf, h, rowStride) {
	for (let i = 0; i < h; i++) {
		const rowBuf = mozJpeg.getMemoryUint8View(rowBufLocation.startPtr, rowBufLocation.length)
		rowBuf.set(pixBuf.subarray(i * rowStride, (i + 1) * rowStride))
		mozJpeg.write_scanlines()
	}
}

/**
 * @param {MozJPEG} mozJpeg
 * @param {number} w
 * @param {number} h
 * @param {number} quality
 * @param {Uint8Array|Uint8ClampedArray} pixBuf
 * @returns {ArrayBuffer[]}
 */
export function compressSimpleRGBA(mozJpeg, w, h, quality, pixBuf) {
	const channels = 4
	let { rowBufLocation, imgChunks } = initCompressSimple(mozJpeg, w, h, JCS_EXT_RGBA, channels)

	// mozJpeg.cinfo_set_out_color_space(JCS_YCCK)
	// mozJpeg.cinfo_set_quant_table(8)
	mozJpeg.cinfo_set_quality(quality, -1)
	// mozJpeg.cinfo_set_optimize_coding(false)
	// mozJpeg.cinfo_set_chroma_subsample(1, 2)
	// mozJpeg.cinfo_set_smoothing_factor(1)
	// mozJpeg.cinfo_disable_progression()
	// mozJpeg.cinfo_set_trellis(5, true, true, true)

	mozJpeg.start_compress()
	writeRowsSimple(mozJpeg, rowBufLocation, pixBuf, h, w * channels)
	mozJpeg.finish_compress()

	return imgChunks
}
