#include "custom_libc.h"
#include "stdlib.h"
#include "stddef.h"
#include "cdjpeg.h"
#include "jpeglib.h"
#include <stdbool.h>
#include <inttypes.h>
#include <emscripten.h>

void fail(char *msg)
{
	fprintf(stderr, "fail: %s", msg);
	exit(1);
}

FILE *const stdout = (FILE *)1;
FILE *const stderr = (FILE *)2;
FILE *const outImgFile = (FILE *)10042;

struct jpeg_error_mgr jerr;
struct jpeg_compress_struct cinfo;
uint8_t *in_row_buffer;

EMSCRIPTEN_KEEPALIVE
void *init_compress(int width, int height, int in_color_space, int channels)
{
	free_everything();

	memset(&jerr, 0, sizeof(jerr));
	memset(&cinfo, 0, sizeof(cinfo));

	cinfo.err = jpeg_std_error(&jerr);

	jpeg_create_compress(&cinfo);
	// jpeg_mem_dest(&cinfo, &result, &length);
	jpeg_stdio_dest(&cinfo, outImgFile);

	cinfo.image_width = width;
	cinfo.image_height = height;
	cinfo.input_components = channels;
	cinfo.in_color_space = in_color_space;
	jpeg_set_defaults(&cinfo);

	return in_row_buffer = malloc(width * channels);
}

EMSCRIPTEN_KEEPALIVE
void cinfo_set_out_color_space(int value)
{
	jpeg_set_colorspace(&cinfo, value);
}

EMSCRIPTEN_KEEPALIVE
void cinfo_set_quant_table(int value)
{
	jpeg_c_set_int_param(&cinfo, JINT_BASE_QUANT_TBL_IDX, value);
}

EMSCRIPTEN_KEEPALIVE
void cinfo_set_optimize_coding(bool value)
{
	cinfo.optimize_coding = value;
}

// EMSCRIPTEN_KEEPALIVE
// void cinfo_set_arithmetic(bool value) {
// 	cinfo.arith_code = value;
// }

EMSCRIPTEN_KEEPALIVE
void cinfo_set_smoothing_factor(int value)
{
	cinfo.smoothing_factor = value;
}

EMSCRIPTEN_KEEPALIVE
void cinfo_set_trellis(int num_loops, bool use_multipass, bool optimize_zero_blocks, bool optimize_table)
{
	jpeg_c_set_bool_param(&cinfo, JBOOLEAN_USE_SCANS_IN_TRELLIS, use_multipass);
	jpeg_c_set_bool_param(&cinfo, JBOOLEAN_TRELLIS_EOB_OPT, optimize_zero_blocks);
	jpeg_c_set_bool_param(&cinfo, JBOOLEAN_TRELLIS_Q_OPT, optimize_table);
	jpeg_c_set_int_param(&cinfo, JINT_TRELLIS_NUM_LOOPS, num_loops);
}

EMSCRIPTEN_KEEPALIVE
void cinfo_set_channel_samp_factor(int component, int h_samp_factor, int v_samp_factor)
{
	cinfo.comp_info[component].h_samp_factor = h_samp_factor;
	cinfo.comp_info[component].v_samp_factor = v_samp_factor;
}

EMSCRIPTEN_KEEPALIVE
void cinfo_set_chroma_subsample(int h_samp_factor, int v_samp_factor)
{
	cinfo_set_channel_samp_factor(0, h_samp_factor, v_samp_factor);
}

EMSCRIPTEN_KEEPALIVE
void cinfo_set_quality(int luma_quality, int chroma_quality)
{
	if (luma_quality < 0 || luma_quality > 100)
		fail("wrong quality value");
	if (chroma_quality > 100)
		fail("wrong quality value");
	if (chroma_quality < 0)
		chroma_quality = luma_quality;

	set_quality_ratings_simple(&cinfo, luma_quality, chroma_quality, /* baseline */ TRUE);

	// Disabling subsampling when high-quality color is desired.
	// See set_quality_ratings in rdswitch.c
	if (chroma_quality >= 90) {
		cinfo_set_chroma_subsample(1, 1);
	} else if (chroma_quality >= 80) {
		cinfo_set_chroma_subsample(2, 1);
	}
}

EMSCRIPTEN_KEEPALIVE
void cinfo_disable_progression()
{
	// enabled by default (cinfo->master->compress_profile == JCP_MAX_COMPRESSION)
	// jpeg_simple_progression(&cinfo);
	cinfo.num_scans = 0;
	cinfo.scan_info = NULL;
}

EMSCRIPTEN_KEEPALIVE
void start_compress()
{
	jpeg_start_compress(&cinfo, TRUE);
}

EMSCRIPTEN_KEEPALIVE
bool write_scanlines()
{
	JSAMPROW row_pointer[1] = {in_row_buffer};
	jpeg_write_scanlines(&cinfo, row_pointer, 1);
	return cinfo.next_scanline >= cinfo.image_height;
}

EMSCRIPTEN_KEEPALIVE
void finish_compress()
{
	jpeg_finish_compress(&cinfo);
	jpeg_destroy_compress(&cinfo);
	free_everything();
}
