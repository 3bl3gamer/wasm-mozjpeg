import {
	initCompressSimple,
	JCS_CMYK,
	JCS_EXT_ABGR,
	JCS_EXT_ARGB,
	JCS_EXT_BGR,
	JCS_EXT_BGRA,
	JCS_EXT_RGB,
	JCS_EXT_RGBA,
	JCS_GRAYSCALE,
	JCS_RGB,
	JCS_YCbCr,
	JCS_YCCK,
	loadWebModule,
	writeRowsSimple,
} from '../../index.js'

const anyWindow = /** @type {*} */ (window)
const defaultCfgBox = /** @type {HTMLPreElement} */ (anyWindow.defaultCfgBox)
const testsTable = /** @type {HTMLTableElement} */ (anyWindow.testsTable)

const colorSpaceNames = {
	[JCS_GRAYSCALE]: 'GRAYSCALE',
	[JCS_RGB]: 'RGB',
	[JCS_YCbCr]: 'YCbCr',
	[JCS_CMYK]: 'CMYK',
	[JCS_YCCK]: 'YCCK',
	[JCS_EXT_RGB]: 'EXT_RGB',
	[JCS_EXT_BGR]: 'EXT_BGR',
	[JCS_EXT_RGBA]: 'EXT_RGBA',
	[JCS_EXT_BGRA]: 'EXT_BGRA',
	[JCS_EXT_ABGR]: 'EXT_ABGR',
	[JCS_EXT_ARGB]: 'EXT_ARGB',
}
function getColorSpaceChannelCount(colorSpace) {
	if (colorSpace === JCS_GRAYSCALE) return 1
	if ([JCS_RGB, JCS_YCbCr, JCS_EXT_RGB, JCS_EXT_BGR].includes(colorSpace)) return 3
	return 4
}

function fillDummyPixBuffer(w, h) {
	const buf = new Uint8ClampedArray(w * h * 4)
	for (let i = 0; i < w; i++) {
		for (let j = 0; j < h; j++) {
			const pos = (i + j * w) * 4
			buf[pos + 0] = (i * j - 0.1) % 256
			buf[pos + 1] = (i + j) % 256
			buf[pos + 2] = (2 ** 20 - Math.sqrt(i ** 2 + j ** 2)) % 256
			buf[pos + 3] = 255
		}
	}
	for (let i = 0; i < 48; i++) {
		for (let j = 0; j < 48; j++) {
			const pos = (i + j * w) * 4
			const redLine = (i + j * 0.5) % 32 <= 1
			const blueLine = (i + j * 0.5 + 16) % 32 <= 1
			buf[pos + 0] = redLine ? 255 : 0
			buf[pos + 1] = redLine || blueLine ? 64 : 128
			buf[pos + 2] = blueLine ? 255 : 64
		}
	}
	for (let i = w - 48; i < w; i++) {
		for (let j = 0; j < 48; j++) {
			const pos = (i + j * w) * 4
			const line = (i + j * 0.5) % 16 <= 1
			buf[pos + 0] = line ? 255 : 128
			buf[pos + 1] = line ? 255 : 128
			buf[pos + 2] = line ? 255 : 128
		}
	}

	const canvas = document.createElement('canvas')
	canvas.width = w
	canvas.height = h
	const rc = canvas.getContext('2d')
	rc && rc.putImageData(new ImageData(buf, w, h), 0, 0)
	return { w, h, buf, canvas }
}
function stripBufChannels(buf, channels) {
	const resBuf = new Uint8ClampedArray((buf.length / 4) * channels)
	for (let i = 0; i < buf.length / 4; i += 1)
		for (let j = 0; j < channels; j++) resBuf[i * channels + j] = buf[i * 4 + j]
	return resBuf
}

function baseCFG() {
	return {
		name: '',
		forceWidth: null,
		inColorSpace: JCS_EXT_RGBA,
		outColorSpace: JCS_YCbCr,
		quantTableId: 3,
		lumaQuality: 75,
		chromaQuality: -1,
		optimizeCoding: true,
		chromaSubsamleH: 2,
		chromaSubsamleV: 2,
		sampFactor: null,
		smoothingFactor: 0,
		progression: true,
		trellisNumLoops: 0,
		trellisMultipass: false,
		trellisOptimizeZeroBlocks: false,
		trellisOptimizeTable: false,
	}
}

const tests = []
for (const lumaQuality of [0, 10, 30, 50, 75, 100]) tests.push({ name: 'quality', lumaQuality })
for (const chromaQuality of [10, 50]) tests.push({ name: 'quality', lumaQuality: 100, chromaQuality })

for (const smoothingFactor of [0, 5])
	for (const chromaSubsamleH of [2, 1])
		for (const chromaSubsamleV of [2, 1])
			if (smoothingFactor === 0 || chromaSubsamleH === chromaSubsamleV)
				tests.push({
					name: 'subsampling,\nsmoothing',
					smoothingFactor,
					chromaSubsamleH,
					chromaSubsamleV,
				})

for (let id = 0; id <= 8; id++) tests.push({ name: 'quantization\ntable', quantTableId: id })

for (const optimizeCoding of [false, true]) tests.push({ name: 'optimize\ncoding', optimizeCoding })

for (const progression of [false, true]) tests.push({ name: 'progression', progression })

for (const trellisNumLoops of [1, 10])
	for (const f of [false, true])
		tests.push({
			name: 'trellis',
			trellisNumLoops,
			trellisMultipass: f,
			trellisOptimizeZeroBlocks: f,
			trellisOptimizeTable: f,
		})
tests.push({ name: 'trellis', trellisNumLoops: 0 })

for (let i = 0; i < 3; i++)
	tests.push({
		name: 'singe component\nsampling',
		sampFactor: { component: i, h: 2, v: 2 },
		outColorSpace: JCS_RGB,
	})

for (const lumaQuality of [50, 100])
	for (const chromaQuality of [50, 100])
		tests.push({
			name: 'YCCK separate\nquality',
			lumaQuality,
			chromaQuality,
			chromaSubsamleH: 2, // for YCCK 2x2 is default sampling factor for frist channel (and for last too)
			chromaSubsamleV: 2,
			inColorSpace: JCS_CMYK,
			outColorSpace: JCS_YCCK,
		})

const rgbColorSpaces = [
	JCS_RGB,
	JCS_EXT_RGB,
	JCS_EXT_BGR,
	JCS_EXT_RGBA,
	JCS_EXT_BGRA,
	JCS_EXT_ABGR,
	JCS_EXT_ARGB,
]
const outputColorSpaces = [JCS_GRAYSCALE, JCS_RGB, JCS_YCbCr, JCS_CMYK, JCS_YCCK]
for (const cs of outputColorSpaces)
	tests.push({
		name: 'color spaces\nwith null\nconversion',
		inColorSpace: cs,
		outColorSpace: cs,
	})
for (const cs of rgbColorSpaces)
	if (cs !== JCS_RGB)
		tests.push({
			name: 'color spaces\nwith RGB→RGB\nconversion',
			inColorSpace: cs,
			outColorSpace: JCS_RGB,
		})
for (const [inColorSpace, outColorSpace] of [
	[JCS_RGB, JCS_YCbCr],
	[JCS_RGB, JCS_GRAYSCALE],
	[JCS_EXT_RGBA, JCS_GRAYSCALE],
	[JCS_EXT_BGR, JCS_GRAYSCALE],
	[JCS_YCbCr, JCS_GRAYSCALE],
	[JCS_CMYK, JCS_YCCK],
])
	tests.push({
		name: 'color spaces\nwith conversion',
		inColorSpace,
		outColorSpace,
		...(outColorSpace === JCS_GRAYSCALE ? { progression: false } : {}),
	})

tests.push({
	name: 'unsupported\nconversion',
	inColorSpace: JCS_YCbCr,
	outColorSpace: JCS_RGB,
})
tests.push({
	name: 'unsupported\nsize',
	forceWidth: 100000,
})

const lastLogMessages = []
const mozJpegPromise = loadWebModule({
	onStdout(msg) {
		console.warn(msg)
		lastLogMessages.push('stdout: ' + msg)
	},
	onStderr(msg) {
		console.error(msg)
		lastLogMessages.push('stderr: ' + msg)
	},
})
;(async () => {
	const mozJpeg = await mozJpegPromise
	const { w, h, buf, canvas } = fillDummyPixBuffer(384, 64)

	const colorSpaceAsStr = (key, val) => (key.endsWith('ColorSpace') ? colorSpaceNames[val] : val)
	defaultCfgBox.textContent = JSON.stringify(baseCFG(), colorSpaceAsStr, '  ')
	let prevNameCell = null

	testsTable.onmouseover = e => {
		const imgWrap = e.target instanceof Image && e.target.closest('.wrap')
		if (imgWrap) imgWrap.appendChild(canvas)
	}
	testsTable.onmouseout = e => {
		canvas.remove()
	}

	for (const test of tests) {
		/** @type {ReturnType<typeof baseCFG>} */
		const cfg = Object.assign(baseCFG(), test)

		const inChannels = getColorSpaceChannelCount(cfg.inColorSpace)
		const curBuf = inChannels === 4 ? buf : stripBufChannels(buf, inChannels)
		let { rowBufLocation, imgChunks } = initCompressSimple(
			mozJpeg,
			cfg.forceWidth ?? w,
			h,
			cfg.inColorSpace,
			inChannels,
		)

		mozJpeg.cinfo_set_out_color_space(cfg.outColorSpace)
		mozJpeg.cinfo_set_quant_table(cfg.quantTableId)
		mozJpeg.cinfo_set_quality(cfg.lumaQuality, cfg.chromaQuality)
		mozJpeg.cinfo_set_optimize_coding(cfg.optimizeCoding)
		if (cfg.sampFactor === null) {
			mozJpeg.cinfo_set_chroma_subsample(cfg.chromaSubsamleH, cfg.chromaSubsamleV)
		} else {
			const f = cfg.sampFactor
			mozJpeg.cinfo_set_channel_samp_factor(f.component, f.h, f.v)
		}
		mozJpeg.cinfo_set_smoothing_factor(cfg.smoothingFactor)
		if (!cfg.progression) mozJpeg.cinfo_disable_progression()
		if (cfg.trellisNumLoops !== 0)
			mozJpeg.cinfo_set_trellis(
				cfg.trellisNumLoops,
				cfg.trellisMultipass,
				cfg.trellisOptimizeZeroBlocks,
				cfg.trellisOptimizeTable,
			)

		try {
			mozJpeg.start_compress()
			writeRowsSimple(mozJpeg, rowBufLocation, curBuf, h, w * inChannels)
			mozJpeg.finish_compress()
		} catch (ex) {
			lastLogMessages.push(ex + '')
		}

		const blob = new Blob(imgChunks, { type: 'image/jpeg' })

		const row = testsTable.tBodies[0].insertRow(-1)

		if (prevNameCell !== null && prevNameCell.textContent === cfg.name) {
			prevNameCell.rowSpan += 1
		} else {
			if (prevNameCell !== null) {
				const sepRow = testsTable.tBodies[0].insertRow(testsTable.tBodies[0].children.length - 1)
				sepRow.className = 'separator'
				sepRow.insertCell(-1).colSpan = 4
			}
			const nameCell = row.insertCell(-1)
			nameCell.className = 'group-name'
			nameCell.textContent = cfg.name
			prevNameCell = nameCell
		}

		const infoCell = row.insertCell(-1)
		infoCell.className = 'config-diff'
		const pre = document.createElement('pre')
		const items = []
		for (const key in baseCFG()) {
			if (key !== 'name' && key in test)
				items.push(
					key +
						': ' +
						(key.endsWith('ColorSpace')
							? colorSpaceNames[cfg[key]]
							: key === 'sampFactor'
							? JSON.stringify(cfg[key])
							: cfg[key]),
				)
		}
		pre.textContent = items.length === 0 ? '<default>' : items.join('\n')
		infoCell.appendChild(pre)

		const imgCell = row.insertCell(-1)
		imgCell.className = 'result-image'
		const wrap = document.createElement('div')
		wrap.className = 'wrap'
		imgCell.appendChild(wrap)
		const img = new Image()
		img.src = URL.createObjectURL(blob)
		wrap.appendChild(img)

		{
			const logCell = row.insertCell(-1)
			const pre = document.createElement('pre')
			pre.textContent =
				(blob.size === 0 ? '' : (blob.size / 1024).toFixed(1) + 'KiB') + lastLogMessages.join('\n')
			lastLogMessages.length = 0
			logCell.appendChild(pre)
		}

		await new Promise(res => setTimeout(res, 10))
	}
})().catch(console.error)
