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
 * @prop {() => void} cinfo_set_simple_progression
 * @prop {() => void} start_compress
 * @prop {() => boolean} write_scanlines
 * @prop {() => void} finish_compress
 */
/**
 * @returns {Promise<MozJPEG>}
 */
export function loadWebModule(): Promise<MozJPEG>;
/**
 * @typedef {{promises:{readFile(fpath:string):Promise<Buffer>}}} ReadableFS
 * @param {Promise<ReadableFS> | ReadableFS} fs
 * @returns {Promise<MozJPEG>}
 */
export function loadNodeModule(fs: Promise<ReadableFS> | ReadableFS): Promise<MozJPEG>;
/**
 * @param {(importObject:Object) => Promise<WebAssembly.WebAssemblyInstantiatedSource>} loadFunc
 * @returns {Promise<MozJPEG>}
 */
export function loadModule(loadFunc: (importObject: any) => Promise<WebAssembly.WebAssemblyInstantiatedSource>): Promise<MozJPEG>;
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
export function initCompressSimple(mozJpeg: MozJPEG, w: number, h: number, inColorSpace: InColorSpace, channels: number): {
    rowBufLocation: BufferLocation;
    imgChunks: ArrayBuffer[];
};
/**
 * @param {MozJPEG} mozJpeg
 * @param {BufferLocation} rowBufLocation
 * @param {Uint8Array|Uint8ClampedArray} pixBuf
 * @param {number} h
 * @param {number} rowStride
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
    onImgChunk: (start: Pointer, length: number) => void;
    init_compress: (width: number, height: number, in_color_space: InColorSpace, channels: number) => Pointer;
    cinfo_set_out_color_space: (value: OutColorSpace) => void;
    cinfo_set_quant_table: (value: number) => void;
    cinfo_set_optimize_coding: (value: boolean) => void;
    cinfo_set_smoothing_factor: (value: number) => void;
    cinfo_set_trellis: (num_loops: number, use_multipass: boolean, optimize_zero_blocks: boolean, optimize_table: boolean) => void;
    cinfo_set_quality: (luma_quality: number, chroma_quality: number) => void;
    cinfo_set_chroma_subsample: (h_samp_factor: number, v_samp_factor: number) => void;
    cinfo_set_simple_progression: () => void;
    start_compress: () => void;
    write_scanlines: () => boolean;
    finish_compress: () => void;
};
export type ReadableFS = {
    promises: {
        readFile(fpath: string): Promise<Buffer>;
    };
};
export type BufferLocation = {
    startPtr: Pointer;
    length: number;
};
