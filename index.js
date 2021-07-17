import { JCS_CMYK, JCS_YCbCr, JCS_YCCK } from './const.js'
import { JCS_EXT_RGBA } from './const.js'
import { getString, putString, simpleSprintf, simpleSscanf } from './utils.js'

export * from './const.js'

const STDOUT_PTR = 1
const STDERR_PTR = 2
const OUT_IMG_FILE_PTR = 10042

/** @typedef {number} Pointer */

/** @typedef {import('./const').JCS_GRAYSCALE | import('./const').JCS_RGB | import('./const').JCS_YCbCr | import('./const').JCS_CMYK | import('./const').JCS_YCCK} OutColorSpace */
/** @typedef {import('./const').JCS_GRAYSCALE | import('./const').JCS_RGB | import('./const').JCS_YCbCr | import('./const').JCS_CMYK | import('./const').JCS_YCCK | import('./const').JCS_EXT_RGB | import('./const').JCS_EXT_BGR | import('./const').JCS_EXT_RGBA | import('./const').JCS_EXT_BGRA | import('./const').JCS_EXT_ABGR | import('./const').JCS_EXT_ARGB} InColorSpace */

/**
 * @typedef {Object} MozJPEG
 * @prop {WebAssembly.Instance} instance
 * @prop {WebAssembly.Memory} memory
 * @prop {(start:Pointer, length:number) => Uint8Array} getMemoryUint8View
 * @prop {(start:Pointer, length:number) => void} onImgChunk - called when next JPEG file chunk is ready an must be copied out from WASM memory
 * @prop {(width:number, height:number, in_color_space:InColorSpace, channels:number) => Pointer} init_compress - initialize and set default MozJPEG settings. Must be called before cinfo_* funcs.
 * @prop {(value:OutColorSpace) => void} cinfo_set_out_color_space
 * @prop {(value:number) => void} cinfo_set_quant_table - set quant table index (3 by default, more info at https://github.com/mozilla/mozjpeg/blob/master/README-mozilla.txt#L171-L186)
 * @prop {(value:boolean) => void} cinfo_set_optimize_coding - compute optimal Huffman coding tables (true by default, more info at https://github.com/mozilla/mozjpeg/blob/master/libjpeg.txt)
 * @prop {(value:number) => void} cinfo_set_smoothing_factor - image smoothing (1-100, 0 by default)
 * @prop {(num_loops:number, use_multipass:boolean, optimize_zero_blocks:boolean, optimize_table:boolean) => void} cinfo_set_trellis - configures Trellis quantisation passes (slower, slight better quality, more info at https://github.com/mozilla/mozjpeg/blob/master/README-mozilla.txt)
 * @prop {(luma_quality:number, chroma_quality:number) => void} cinfo_set_quality - set luma (Y) and chroma (Cb,Cr) quality (0-100; if chroma is set to -1, the luma value will be used)
 * @prop {(h_samp_factor:number, v_samp_factor:number) => void} cinfo_set_chroma_subsample - downscale chroma channels (Cb and Cr) by `factor` times (2x2 by default if quality < 80, 2x1 if quality < 90, 1x1 otherwise)
 * @prop {() => void} cinfo_disable_progression - output regular (sequential) JPEG (will be progressive by default)
 * @prop {() => void} start_compress - start compression, get ready to accept lines. Must be called after cinfo_* funcs (if any).
 * @prop {() => boolean} write_scanlines - send lines (one line currently) to compressor. Must be called for all image lines after start_compress().
 * @prop {() => void} finish_compress - complete the compression cycle (write out remainig data). Must be called after write_scanlines() calls.
 */

/**
 * @typedef {Object} ModuleOptions
 * @prop {((msg:string) => unknown)|null} [onStdout=console.warn] - handle MozJpeg stdout messages (console.warn is used by dfault)
 * @prop {((msg:string) => unknown)|null} [onStderr=console.error] - handle MozJpeg stderr messages (console.error is used by dfault)
 * @prop {((newPages:number, totalBytes:number, lastAllocBytes:number) => unknown)|null} [opts.onMemGrow] - handle WASM memory growth.
 */

/**
 * Load WASM module by fetch'ing it and processing as stream. Suitable for Web.
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
 * Load WASM module from file system. Suitable for Node.js.
 * @typedef {{promises:{readFile(fpath:string):Promise<Buffer>}}} ReadableFS
 * @param {Promise<ReadableFS> | ReadableFS} fs - node `js` package (or any other object with fs.promises.readFile() func)
 * @param {ModuleOptions|null} [opts]
 * @returns {Promise<MozJPEG>}
 */
export function loadNodeModule(fs, opts) {
	return loadModule(async importObject => {
		const filepath = new URL('mozjpeg.wasm', import.meta.url).pathname
		return WebAssembly.instantiate(await (await fs).promises.readFile(filepath), importObject)
	}, opts)
}

// /**
//  * For experiments/testing/debugging. Generate from .wasm-file with:
//  *   echo -n 'export ' > mozjpeg.wasm.js
//  *   wasm2js --emscripten mozjpeg.wasm >> mozjpeg.wasm.js
//  * @param {ModuleOptions|null} [opts]
//  * @returns {Promise<MozJPEG>}
//  */
// export function loadJSModule(opts) {
// 	return loadModule(async importObject => {
// 		const exports = (await import('./mozjpeg.wasm.js')).instantiate(importObject.env)
// 		return { instance: { exports }, module: {} }
// 	})
// }

/**
 * Load module by calling external `loadFunc`.
 * Actually, `loadModule` will just init the WASM module that came from `loadFunc`.
 * @param {(importObject:Object) => Promise<WebAssembly.WebAssemblyInstantiatedSource>} loadFunc
 * @param {ModuleOptions|null} [opts]
 * @returns {Promise<MozJPEG>}
 */
export async function loadModule(loadFunc, opts) {
	opts ??= {}
	const onStdout = opts.onStdout ?? console.warn
	const onStderr = opts.onStderr ?? console.error
	const onMemGrow = opts.onMemGrow

	let lastStderrMsg = /** @type {string|null} */ (null)
	/**
	 * @param {number} filePtr
	 * @param {string} string
	 */
	function onPrint(filePtr, string) {
		if (filePtr === STDOUT_PTR) {
			onStdout(string)
		} else if (filePtr === STDERR_PTR) {
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
				if (streamPtr === OUT_IMG_FILE_PTR) mozJpeg.onImgChunk(bufPtr, count * size)
				else onPrint(streamPtr, getString(memBuf, bufPtr, count * size))
				return count
			},
			fiprintf(fdPtr, formatPtr, argsPtr) {
				// console.log('fiprintf', arguments, getString(memBuf, formatPtr))
				onPrint(fdPtr, simpleSprintf(memBuf, formatPtr, argsPtr))
				return 0
			},
			fputc(byte, fdPtr) {
				// console.error('fputc', arguments)
				onPrint(fdPtr, String.fromCharCode(byte))
				return byte
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
 * Simple init func. Returns row buffer location (to use with `write_scanlines`)
 * and array that will be filled with ArrayBuffer-chunks after compression.
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
 * Sends all image buffer pixels to MozJPEG line-by-line.
 * @param {MozJPEG} mozJpeg
 * @param {BufferLocation} rowBufLocation - where in WASM memory to write pixel data
 * @param {Uint8Array|Uint8ClampedArray} pixBuf - source buffer
 * @param {number} h - number of rows (height)
 * @param {number} rowStride - row stride, typically width*bytes_per_pixel
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
