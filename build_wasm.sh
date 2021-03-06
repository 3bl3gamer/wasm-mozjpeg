#!/bin/bash
set -e


echo ""
echo " === Building MozJPEG === "
echo ""

cd mozjpeg

# FACEPALM
# "type":"module" in root directory *silently* breaks something
# in emscripten's types size detection (UNSIGNED_LONG etc.)
# and they all change to 1 byte.
# Affects CMakeLists.txt and jcphuff.c (#if SIZEOF_SIZE_T == 4 and others).
echo '{"type":"commonjs"}' > package.json

emcmake cmake -G"Unix Makefiles" \
  -DCMAKE_C_COMPILER=emcc \
  -DCMAKE_SIZEOF_VOID_P=4 \
  -DPNG_SUPPORTED=0 \
  -DWITH_SIMD=0 \
  -DENABLE_SHARED=0 \
  -DWITH_TURBOJPEG=0 \
  -DCMAKE_C_FLAGS='-DNO_GETENV=1' \
  .

emmake make -j 4

cd -


echo ""
echo " === Building mozjpeg.wasm === "
echo ""

emcc \
  -s TOTAL_STACK=1MB \
  -s TOTAL_MEMORY=2MB \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s MAXIMUM_MEMORY=512mb \
  -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
  -Wall -O3 -flto -Wl,--lto-O3,--no-entry \
  -nostdlib \
  -I mozjpeg \
  -o mozjpeg.wasm \
  mozjpeg.c custom_libc.c mozjpeg/libjpeg.a mozjpeg/rdswitch.c


echo ""
echo " === Generating const.js === "
echo ""

echo '#include <emscripten.h>' > temp.c
echo '#include "cdjpeg.h"' >> temp.c
for name in JCS_GRAYSCALE JCS_RGB JCS_YCbCr JCS_CMYK JCS_YCCK JCS_EXT_RGB JCS_EXT_BGR JCS_EXT_RGBA JCS_EXT_BGRA JCS_EXT_ABGR JCS_EXT_ARGB
do
  echo "EMSCRIPTEN_KEEPALIVE const J_COLOR_SPACE _$name = $name;" >> temp.c
done

emcc -Wall -O3 -s TOTAL_STACK=1KB -s TOTAL_MEMORY=64KB -I mozjpeg -Wl,--no-entry -nostdlib -o temp.wasm temp.c

node -e "
WebAssembly.instantiate(fs.readFileSync('temp.wasm')).then(({instance:{exports}}) => {
  console.log(
    Object.entries(exports)
      .filter(([name,]) => name.startsWith('_JCS_'))
      .map(([name,exp]) => \`export const \${name.substr(1)} = \${new Uint32Array(exports.memory.buffer, exp.value)[0]}\`)
      .join('\\n')
  )
})" > const.js

rm temp.c temp.wasm

echo " === Done === "
