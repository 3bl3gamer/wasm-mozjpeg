#include <stddef.h>
#include <stdio.h>

extern unsigned char __heap_base;

void after_memory_grow(size_t, size_t);

#define MEMORY_ALIGN 8
#define PAGE_SIZE 65536

/*
 * Very simple memory allocator.
 * It remembers (and tries to reuse after freeing) limited number allocs.
 * If there are more of them, allocator will leak, but it is not a problem (see free_everything).
 *
 * Since all the allocated memory will be freed with free_everything() after the compression at once,
 * regular "accurate" allocator is not required here. Its main task is to try to lower
 * the memory usage *during* encoding, while being fast and compact.
 *
 * It remembers only MAX_ALLOCS_COUNT allocs.
 * It does not "defragment" (i.e. does not merge adjacent freed memory chunks).
 * It does not split chunks on reuse (i.e. when 2KB allocation was freed and then 1KB was allocated).
 * And still it has only 5-20% memory usage overhead (compared to the total size of all alocated memory chunks).
 */

struct alloc_item {
	/*
	 * Pointer to memory chunk.
	 * When NULL, the item is considered blank/empty/not-yet-used.
	 */
	char* ptr;
	/* Total memory chunk size */
	size_t size;
	/*
	 * Actual amount of memory used from this chunk.
	 * Will equal to `size` when the item is first created, but may become smaller if chunk was freed and reused.
	 * When zero, the chunk is considered free and may be later reused.
	 */
	size_t size_used;
};

// 64 seems ok:
//   it is small enough to not affect the performance,
//   it is large enough to remember, free and reuse almost all allocations
#define MAX_ALLOCS_COUNT 64

struct alloc_item allocs[MAX_ALLOCS_COUNT];

void *malloc(size_t n)
{
	if (n == 0) return NULL;

	size_t n_aligned = (((n - 1) / MEMORY_ALIGN) + 1) * MEMORY_ALIGN;

	char* next_free_ptr = (char*)&__heap_base; //start of free and unused heap region where new chunks of any size can be allocated
	struct alloc_item* smallest_alloc = NULL;
	struct alloc_item* empty_alloc = NULL;
	struct alloc_item* fitting_alloc = NULL;

	for (int i = 0; i < MAX_ALLOCS_COUNT; i++)
	{
		struct alloc_item* alloc = &allocs[i];
		if (alloc->ptr == NULL)
		{
			empty_alloc = alloc;
		}
		else
		{
			if (alloc->size_used == 0 && alloc->size >= n_aligned)
			{
				if (fitting_alloc == NULL || (fitting_alloc->size - n_aligned) > (alloc->size - n_aligned))
				{
					fitting_alloc = alloc;
				}
			}

			char* next_ptr = alloc->ptr + alloc->size;
			if (next_ptr > next_free_ptr)
			{
				next_free_ptr = next_ptr;
			}

			if (smallest_alloc == NULL || smallest_alloc->size > alloc->size)
			{
				smallest_alloc = alloc;
			}
		}
	}

	// requested memory chunk fits into prevously freed chunk? reusing item with this chunk
	if (fitting_alloc != NULL)
	{
		fitting_alloc->size_used = n_aligned;
		return fitting_alloc->ptr;
	}

	// using empty alloc or overwriting smalest existing alloc (latter will leak until free_everything(), this is on purpose)
	struct alloc_item* new_alloc =
		empty_alloc != NULL
			? empty_alloc
			: smallest_alloc;

	// requesting more memory pages
	size_t cur_pages_count = __builtin_wasm_memory_size(0);
	size_t new_pages_count = ((size_t)(next_free_ptr) + n_aligned + PAGE_SIZE - 1) / PAGE_SIZE;
	if (new_pages_count > cur_pages_count)
	{
		if (__builtin_wasm_memory_grow(0, new_pages_count - cur_pages_count) == -1)
			return NULL; //not enough memory

		after_memory_grow(new_pages_count - cur_pages_count, n);

		// size_t used_size = 0;
		// int used_count = 0;
		// for (int i = 0; i < MAX_ALLOCS_COUNT; i++)
		// {
		// 	if (allocs[i].ptr != NULL && allocs[i].size_used != 0)
		// 	{
		// 		used_size += allocs[i].size_used;
		// 		used_count += 1;
		// 	}
		// }
		// fprintf(stdout, "used: %dK, count: %d/%d", used_size/1024, used_count, MAX_ALLOCS_COUNT);
	}

	new_alloc->ptr = next_free_ptr;
	new_alloc->size = n_aligned;
	new_alloc->size_used = n_aligned;

	return next_free_ptr;
}

void free(void *p)
{
	// alloc may not be found here, it is ok, memory will be freed with free_everything()
	for (int i = 0; i < MAX_ALLOCS_COUNT; i++)
	{
		if (allocs[i].ptr == p)
		{
			allocs[i].size_used = 0; //allowing this chunk reuse
			break;
		}
	}
}

void free_everything()
{
	for (int i = 0; i < MAX_ALLOCS_COUNT; i++)
		allocs[i].ptr = 0;
}

// Using Math.pow from JS. The encoding speed is about the same
// as with Musl's math.h (bundled with Emscripten), but the .wasm is about ~3KB smaller.
double math_pow(double, double);

double exp2(double n)
{
	return math_pow(2.0, n);
}
