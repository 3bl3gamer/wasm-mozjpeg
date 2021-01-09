/**
 * @param {Uint8Array} mem
 * @param {number} startPtr
 * @param {number|undefined} [len]
 */
export function getString(mem: Uint8Array, startPtr: number, len?: number | undefined): string;
/**
 * @param {Uint8Array} mem
 * @param {number} destPtr
 * @param {string} str
 */
export function putString(mem: Uint8Array, destPtr: number, str: string): number;
/**
 * @param {Uint8Array} mem
 * @param {number} formatPtr
 * @param {number} argsPtr
 */
export function simpleSprintf(mem: Uint8Array, formatPtr: number, argsPtr: number): string;
/**
 * @param {Uint8Array} mem
 * @param {number} bufPtr
 * @param {number} formatPtr
 * @param {number} argsPtr
 */
export function simpleSscanf(mem: Uint8Array, bufPtr: number, formatPtr: number, argsPtr: number): number;
