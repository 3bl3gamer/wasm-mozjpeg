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
export function loadWebModule(opts?: ModuleOptions | null): Promise<MozJPEG>;
/**
 * Load WASM module from file system. Suitable for Node.js.
 * @typedef {{promises:{readFile(fpath:string):Promise<Buffer>}}} ReadableFS
 * @param {Promise<ReadableFS> | ReadableFS} fs - node `js` package (or any other object with fs.promises.readFile() func)
 * @param {ModuleOptions|null} [opts]
 * @returns {Promise<MozJPEG>}
 */
export function loadNodeModule(fs: Promise<ReadableFS> | ReadableFS, opts?: ModuleOptions | null): Promise<MozJPEG>;
/**
 * Load module by calling external `loadFunc`.
 * Actually, `loadModule` will just init the WASM module that came from `loadFunc`.
 * @param {(importObject:Object) => Promise<WebAssembly.WebAssemblyInstantiatedSource>} loadFunc
 * @param {ModuleOptions|null} [opts]
 * @returns {Promise<MozJPEG>}
 */
export function loadModule(loadFunc: (importObject: any) => Promise<WebAssembly.WebAssemblyInstantiatedSource>, opts?: ModuleOptions | null): Promise<MozJPEG>;
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
export function initCompressSimple(mozJpeg: MozJPEG, w: number, h: number, inColorSpace: InColorSpace, channels: number): {
    rowBufLocation: BufferLocation;
    imgChunks: ArrayBuffer[];
};
/**
 * Sends all image buffer pixels to MozJPEG line-by-line.
 * @param {MozJPEG} mozJpeg
 * @param {BufferLocation} rowBufLocation - where in WASM memory to write pixel data
 * @param {Uint8Array|Uint8ClampedArray} pixBuf - source buffer
 * @param {number} h - number of rows (height)
 * @param {number} rowStride - row stride, typically width*bytes_per_pixel
 * @returns {void}
 */
export function writeRowsSimple(mozJpeg: MozJPEG, rowBufLocation: BufferLocation, pixBuf: Uint8Array | Uint8ClampedArray, h: number, rowStride: number): void;
/**
 * @param {MozJPEG} mozJpeg
 * @param {number} w
 * @param {number} h
 * @param {number} quality
 * @param {Uint8Array|Uint8ClampedArray} pixBuf
 * @returns {ArrayBuffer[]}
 */
export function compressSimpleRGBA(mozJpeg: MozJPEG, w: number, h: number, quality: number, pixBuf: Uint8Array | Uint8ClampedArray): ArrayBuffer[];
export * from "./const.js";
export type Pointer = number;
export type OutColorSpace = 1 | 2 | 5 | 4 | 3;
export type InColorSpace = 1 | 2 | 8 | 6 | 5 | 4 | 3 | 12 | 13 | 14 | 15;
export type MozJPEG = {
    instance: WebAssembly.Instance;
    memory: WebAssembly.Memory;
    getMemoryUint8View: (start: Pointer, length: number) => Uint8Array;
    /**
     * - called when next JPEG file chunk is ready an must be copied out from WASM memory
     */
    onImgChunk: (start: Pointer, length: number) => void;
    /**
     * - initialize and set default MozJPEG settings. Must be called before cinfo_* funcs.
     */
    init_compress: (width: number, height: number, in_color_space: InColorSpace, channels: number) => Pointer;
    cinfo_set_out_color_space: (value: OutColorSpace) => void;
    /**
     * - set quant table index (3 by default, more info at https://github.com/mozilla/mozjpeg/blob/master/README-mozilla.txt#L171-L186)
     */
    cinfo_set_quant_table: (value: number) => void;
    /**
     * - compute optimal Huffman coding tables (true by default, more info at https://github.com/mozilla/mozjpeg/blob/master/libjpeg.txt)
     */
    cinfo_set_optimize_coding: (value: boolean) => void;
    /**
     * - image smoothing (1-100, 0 by default)
     */
    cinfo_set_smoothing_factor: (value: number) => void;
    /**
     * - configures Trellis quantisation passes (slower, slight better quality, more info at https://github.com/mozilla/mozjpeg/blob/master/README-mozilla.txt)
     */
    cinfo_set_trellis: (num_loops: number, use_multipass: boolean, optimize_zero_blocks: boolean, optimize_table: boolean) => void;
    /**
     * - set luma (Y) and chroma (Cb,Cr) quality (0-100; if chroma is set to -1, the luma value will be used)
     */
    cinfo_set_quality: (luma_quality: number, chroma_quality: number) => void;
    /**
     * - downscale chroma channels (Cb and Cr) by `factor` times (2x2 by default if quality < 80, 2x1 if quality < 90, 1x1 otherwise)
     */
    cinfo_set_chroma_subsample: (h_samp_factor: number, v_samp_factor: number) => void;
    /**
     * - output regular (sequential) JPEG (will be progressive by default)
     */
    cinfo_disable_progression: () => void;
    /**
     * - start compression, get ready to accept lines. Must be called after cinfo_* funcs (if any).
     */
    start_compress: () => void;
    /**
     * - send lines (one line currently) to compressor. Must be called for all image lines after start_compress().
     */
    write_scanlines: () => boolean;
    /**
     * - complete the compression cycle (write out remainig data). Must be called after write_scanlines() calls.
     */
    finish_compress: () => void;
};
export type ModuleOptions = {
    /**
     * - handle MozJpeg stdout messages (console.warn is used by dfault)
     */
    onStdout?: (msg: string) => unknown;
    /**
     * - handle MozJpeg stderr messages (console.error is used by dfault)
     */
    onStderr?: (msg: string) => unknown;
    /**
     * - handle WASM memory growth.
     */
    onMemGrow?: (newPages: number, totalBytes: number, lastAllocBytes: number) => unknown;
};
/**
 * Load WASM module from file system. Suitable for Node.js.
 */
export type ReadableFS = {
    promises: {
        readFile(fpath: string): Promise<Buffer>;
    };
};
export type BufferLocation = {
    startPtr: Pointer;
    length: number;
};
