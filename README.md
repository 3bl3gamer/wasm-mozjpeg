WebAssembly [MozJPEG](https://github.com/mozilla/mozjpeg) encoder.

Inspired by [cyrilwanner/wasm-codecs](https://github.com/cyrilwanner/wasm-codecs), [saschazar21/webassembly/mozjpeg](https://github.com/saschazar21/webassembly/tree/master/packages/mozjpeg) and the thirst for adventures.


## Examples

* [simple](https://3bl3gamer.github.io/wasm-mozjpeg/examples/simple/)
* [settings demonstration](https://3bl3gamer.github.io/wasm-mozjpeg/examples/settings/)


## Features

* 320 KiB before gzip (wasm + js), 35 KiB after;
* TypeScript definitions;
* node and browser support;
* different [input color spaces](https://github.com/3bl3gamer/wasm-mozjpeg/blob/master/const.js);
* `grayscale`, `RGB`, `YCbCr`, `CMYK` and `YCCK` output color spaces (not all in->out transformations supported, see [mozjpeg/libjpeg.txt](https://github.com/mozilla/mozjpeg/blob/master/libjpeg.txt#L1388-L1391));
* disabled arithmetic coding (smaller bundle);
* sequential (aka "bump") memory allocator (smaller bundle, +30% memory usage);
* no build-in worker.


## Installation

`npm install https://github.com/3bl3gamer/wasm-mozjpeg`


## Usage

### Basic

```js
import { loadWebModule, compressSimpleRGBA } from 'wasm-mozjpeg'

loadWebModule().then(mozJpeg => {
    const quality = 75
    const iData = someCanvas.getContext('2d').getImageData(0, 0, 320, 240)

    const imgChunks = compressSimpleRGBA(mozJpeg, iData.width, iData.height, quality, iData.data)
    const blob = new Blob(imgChunks, { type: 'image/jpeg' })

    const img = new Image()
    img.src = URL.createObjectURL(blob)
    document.body.appendChild(img)
})
```

### Advanced

```js
import { loadWebModule, initCompressSimple, writeRowsSimple,
    JCS_EXT_RGBA, JCS_YCbCr } from 'wasm-mozjpeg'

loadWebModule().then(mozJpeg => {
    const iData = someCanvas.getContext('2d').getImageData(0, 0, 320, 240)

    const channels = 4 //R, G, B and A
    let { rowBufLocation, imgChunks } =
        initCompressSimple(mozJpeg, iData.width, iData.height, JCS_EXT_RGBA, channels)

    mozJpeg.cinfo_set_out_color_space(JCS_YCbCr)
    mozJpeg.cinfo_set_quant_table(3)
    mozJpeg.cinfo_set_quality(95, -1)
    mozJpeg.cinfo_set_optimize_coding(true)
    mozJpeg.cinfo_set_chroma_subsample(2, 2)
    mozJpeg.cinfo_set_smoothing_factor(0)
    mozJpeg.cinfo_disable_progression()
    mozJpeg.cinfo_set_trellis(10, true, true, true)

    mozJpeg.start_compress()
    writeRowsSimple(mozJpeg, rowBufLocation, iData.data, iData.height, iData.width * channels)
    mozJpeg.finish_compress()
    const blob = new Blob(imgChunks, { type: 'image/jpeg' })

    const img = new Image()
    img.src = URL.createObjectURL(blob)
    document.body.appendChild(img)
})
```

More info in [index.d.ts](https://github.com/3bl3gamer/wasm-mozjpeg/blob/master/index.d.ts), [mozjpeg/libjpeg.txt](https://github.com/mozilla/mozjpeg/blob/master/libjpeg.txt) and [mozjpeg/README-mozilla.txt](https://github.com/mozilla/mozjpeg/blob/master/README-mozilla.txt).


## Bulding

`./build_wasm.sh` — rebuilds `mozjpeg.wasm`, generates `const.js`, requires `Emscripten`.

`./generate_types.sh` — generates `.d.ts` files by `JSDoc` annotations.
