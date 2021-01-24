import {
	initCompressSimple,
	JCS_CMYK,
	JCS_EXT_RGBA,
	JCS_GRAYSCALE,
	JCS_RGB,
	JCS_YCbCr,
	JCS_YCCK,
	loadWebModule,
	writeRowsSimple,
} from '../../index.js'

const anyWindow = /** @type {*} */ (window)
const logBox = /** @type {HTMLPreElement} */ (anyWindow.logBox)
const samplesTabList = /** @type {HTMLDivElement} */ (anyWindow.samplesTabList)
const samplesBox = /** @type {HTMLDivElement} */ (anyWindow.samplesBox)
const workIndicator = /** @type {HTMLSpanElement} */ (anyWindow.workIndicator)
const addSampleButton = /** @type {HTMLSpanElement} */ (anyWindow.addSampleButton)
const configForm = /** @type {HTMLFormElement} */ (anyWindow.configForm)
const outColorSpaceComment = /** @type {HTMLSpanElement} */ (anyWindow.outColorSpaceComment)
const inputFileComment = /** @type {HTMLSpanElement} */ (anyWindow.inputFileComment)

configForm.onsubmit = e => {
	e.preventDefault()
	generate()
}
addSampleButton.onclick = () => {
	addSample()
}
mustBeNotNull(
	/**@type {HTMLSelectElement|null}*/ (configForm.querySelector('[name="out_color_space"]')),
).onchange = e => {
	const val = /**@type {*}*/ (e.target).value
	outColorSpaceComment.textContent =
		val === 'JCS_GRAYSCALE'
			? 'seems broken'
			: val === 'JCS_YCCK'
			? 'will threat input as YCCK (instead of RGBA), will produce wrong colors'
			: ''
}
mustBeNotNull(
	/**@type {HTMLInputElement|null}*/ (configForm.querySelector('[name="input_file"]')),
).onchange = e => {
	const files = /**@type {*}*/ (e.target).files
	inputFileComment.classList.toggle('hidden', files[0] && files[0].size > 0)
}
window.onkeydown = e => {
	if (e.ctrlKey && e.shiftKey && !e.altKey)
		if (e.keyCode >= '1'.charCodeAt(0) && e.keyCode <= '9'.charCodeAt(0)) {
			const index = e.keyCode - '1'.charCodeAt(0)
			if (index < samplesTabList.children.length) showSampleBox(index)
			e.preventDefault()
		}
}

const mozJpegPromise = loadWebModule()

generate()

async function generate() {
	workIndicator.classList.remove('hidden')
	sleep(20)

	const opts = Object.fromEntries(new FormData(configForm))
	const optInt = name => parseInt(/**@type {string}*/ (opts[name]))
	const optBool = name => opts[name] === 'on'

	const { w, h, buf } =
		opts.input_file && /** @type {File} */ (opts.input_file).size > 0
			? await readImageFileToPixBuffer(/** @type {File} */ (opts.input_file))
			: fillDummyPixBuffer(1024, 384)

	const outColorSpace = {
		JCS_GRAYSCALE: JCS_GRAYSCALE,
		JCS_RGB: JCS_RGB,
		JCS_YCbCr: JCS_YCbCr,
		JCS_CMYK: JCS_CMYK,
		JCS_YCCK: JCS_YCCK,
	}[opts.out_color_space]
	// MozJPEG will refuse to convert RGB[A] to 4-channel outputs (CMYK or YCCK).
	// So, if out color space is CMYK or YCCK, assuming input RGBA to be same as input.
	// It will produce false colors but is suitable for demonstration.
	const isColorSpace = [JCS_CMYK, JCS_YCCK].includes(outColorSpace) ? outColorSpace : JCS_EXT_RGBA

	try {
		const mozJpeg = await mozJpegPromise
		const channels = 4
		let { rowBufLocation, imgChunks } = initCompressSimple(mozJpeg, w, h, isColorSpace, channels)

		mozJpeg.cinfo_set_out_color_space(outColorSpace)
		mozJpeg.cinfo_set_quant_table(optInt('quant_table'))
		mozJpeg.cinfo_set_quality(optInt('quality'), -1)
		mozJpeg.cinfo_set_optimize_coding(optBool('optimize_coding'))
		mozJpeg.cinfo_set_chroma_subsample(optInt('chroma_subsamle_h'), optInt('chroma_subsamle_v'))
		mozJpeg.cinfo_set_smoothing_factor(optInt('smoothing_factor'))
		if (!optBool('progression')) mozJpeg.cinfo_disable_progression()
		if (optInt('trellis__num_loops') !== 0)
			mozJpeg.cinfo_set_trellis(
				optInt('trellis__num_loops'),
				optBool('trellis__multipass'),
				optBool('trellis__optimize_zero_blocks'),
				optBool('trellis__optimize_table'),
			)

		const stt = Date.now()
		mozJpeg.start_compress()
		writeRowsSimple(mozJpeg, rowBufLocation, buf, h, w * channels)
		mozJpeg.finish_compress()
		const elapsed = Date.now() - stt

		const blob = new Blob(imgChunks, { type: 'image/jpeg' })
		const img = mustBeNotNull(getLastSampleBox().querySelector('img'))
		URL.revokeObjectURL(img.src)
		img.src = URL.createObjectURL(blob)

		const speed = (w * h) / 1000 / elapsed
		const infoElem = mustBeNotNull(getLastSampleBox().querySelector('.info'))
		infoElem.textContent =
			`${elapsed}ms, ${speed.toFixed(1)}MPix/s, ` + (blob.size / 1024).toFixed(1) + 'KiB'
	} catch (ex) {
		const infoElem = mustBeNotNull(getLastSampleBox().querySelector('.info'))
		infoElem.textContent = ex
	}
	showLastSampleBox()

	workIndicator.classList.add('hidden')
}

// === ui ===

function log(msg) {
	logBox.textContent += msg + '\n'
}

function addSample() {
	const button = document.createElement('button')
	button.textContent = '#' + samplesTabList.children.length
	button.onmouseover = () => {
		showSampleBox(Array.from(samplesTabList.children).indexOf(button))
	}
	samplesTabList.appendChild(button)
	const wrap = document.createElement('div')
	wrap.innerHTML = '<div class="info"></div><img/>'
	samplesBox.appendChild(wrap)
	showLastSampleBox()
	return wrap
}
function showSampleBox(index) {
	for (const elem of samplesBox.children) elem.classList.add('hidden')
	samplesBox.children[index].classList.remove('hidden')
	for (const elem of samplesTabList.children) elem.classList.remove('selected')
	samplesTabList.children[index].classList.add('selected')
}
function showLastSampleBox() {
	showSampleBox(samplesBox.children.length - 1)
}
function getLastSampleBox() {
	if (samplesBox.children.length > 0) return samplesBox.children[samplesBox.children.length - 1]
	return addSample()
}

// === utils ===

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * @template T
 * @param {T|null} val
 * @returns {T}
 */
export function mustBeNotNull(val) {
	if (val === null) throw new Error('value is null, this should not happen')
	return val
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
	for (let i = 0; i < 64; i++) {
		for (let j = 0; j < 64; j++) {
			const pos = (i + j * w) * 4
			const line = (i + j * 0.5) % 16 <= 1
			buf[pos + 0] = line ? 255 : 0
			buf[pos + 1] = line ? 64 : 128
			buf[pos + 2] = 0
		}
	}
	return { w, h, buf }
}

/**
 * @param {File} file
 * @returns {Promise<{w:number, h:number, buf:Uint8ClampedArray}>}
 */
async function readImageFileToPixBuffer(file) {
	/** @type {HTMLImageElement} */
	const img = await new Promise((resolve, reject) => {
		const img = new Image()
		img.src = URL.createObjectURL(file)
		img.onload = () => {
			resolve(img)
			URL.revokeObjectURL(img.src)
		}
		img.onerror = reject
	})
	const canvas = document.createElement('canvas')
	const { naturalWidth: w, naturalHeight: h } = img
	canvas.width = w
	canvas.height = h
	const rc = mustBeNotNull(canvas.getContext('2d'))
	rc.drawImage(img, 0, 0)
	const idata = rc.getImageData(0, 0, w, h)
	return { w, h, buf: idata.data }
}
