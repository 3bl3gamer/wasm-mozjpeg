#include <stddef.h>
#include <stdio.h>

extern unsigned char __heap_base;

void on_alloc(size_t, size_t);
void on_free(void *);

void after_memory_grow(size_t, size_t);
#define MEMORY_ALIGN (8)
#define PAGE_SIZE (65536)
size_t bump_pointer = (size_t)(&__heap_base);
void *malloc(size_t n)
{
	size_t r = bump_pointer;
	bump_pointer += (((n - 1) / MEMORY_ALIGN) + 1) * MEMORY_ALIGN;

	size_t cur_size = __builtin_wasm_memory_size(0);
	size_t new_size = (bump_pointer + PAGE_SIZE - 1) / PAGE_SIZE;
	if (new_size > cur_size)
	{
		__builtin_wasm_memory_grow(0, new_size - cur_size);
		after_memory_grow(new_size - cur_size, n);
	}

	return (void *)r;
}

void free(void *p)
{
	// lol
}

void free_everything()
{
	bump_pointer = (size_t)(&__heap_base);
}

void *memcpy(void *dest, const void *src, size_t len)
{
	char *d = dest;
	const char *s = src;
	while (len--)
		*d++ = *s++;
	return dest;
}

void *memset(void *dest, int val, size_t len)
{
	unsigned char *ptr = dest;
	while (len-- > 0)
		*ptr++ = val;
	return dest;
}

double math_pow(double, double);

double exp2(double n)
{
	return math_pow(2.0, n);
}
