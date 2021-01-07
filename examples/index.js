import { compressSimpleRGBA, loadModule } from '../index.js'

const anyWindow = /** @type {*} */ (window)
const logBox = /** @type {HTMLPreElement} */ (anyWindow.logBox)
const configForm = /** @type {HTMLFormElement} */ (anyWindow.configForm)
const mozjpegResultImg = /** @type {HTMLImageElement} */ (anyWindow.mozjpegResultImg)
const canvasResultImg = /** @type {HTMLImageElement} */ (anyWindow.canvasResultImg)

function log(msg) {
	logBox.textContent += msg + '\n'
}
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function generate() {
	logBox.textContent = ''
	mozjpegResultImg.src = ''
	canvasResultImg.src = ''

	const mozJpeg = await loadModule()
	const quality = parseInt(new FormData(configForm).get('quality') + '')

	log('generaing image buffer...')
	await sleep(1)

	const w = 2048
	const h = 384
	const buf = new Uint8Array(w * h * 4)
	for (let i = 0; i < w; i++) {
		for (let j = 0; j < h; j++) {
			const pos = (i + j * w) * 4
			buf[pos + 0] = i * j - 0.1
			buf[pos + 1] = i + j
			buf[pos + 2] = 255 - Math.sqrt(i ** 2 + j ** 2)
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

	log('')
	log('compressing image with MozJPEG...')
	await sleep(1)

	const stt = Date.now()
	const imgChunks = compressSimpleRGBA(mozJpeg, w, h, quality, buf)
	const elapsed = Date.now() - stt

	const speed = (w * h) / 1000 / elapsed
	const size = imgChunks.map(x => x.byteLength).reduce((a, b) => a + b)
	log(`done, ${elapsed}ms, ${speed.toFixed(1)}MPix/s, ${(size / 1024).toFixed(1)}KiB`)

	log('displaying image')
	const blob = new Blob(imgChunks, { type: 'image/jpeg' })
	mozjpegResultImg.src = URL.createObjectURL(blob)

	await new Promise((res, rej) => {
		mozjpegResultImg.onload = res
		mozjpegResultImg.onerror = rej
	})

	log('')
	log('compresing image with <canvas>...')
	const canvas = document.createElement('canvas')
	canvas.width = w
	canvas.height = h

	const iData = new ImageData(w, h)
	iData.data.set(buf)
	canvas.getContext('2d')?.putImageData(iData, 0, 0)

	const canvasStt = Date.now()
	canvas.toBlob(
		blob => {
			const elapsed = Date.now() - canvasStt
			log(`done, ${elapsed}ms, ${(blob.size / 1024).toFixed(1)}KiB`)

			log('displaying image')
			canvasResultImg.src = URL.createObjectURL(blob)
		},
		'image/jpeg',
		quality / 100,
	)
}

configForm.onsubmit = e => {
	e.preventDefault()
	generate()
}

generate()
