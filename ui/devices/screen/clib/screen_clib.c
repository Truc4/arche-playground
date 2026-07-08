// C-lib backend shim for the `term` device — fulfils screen_be_* by writing to the real terminal via libc.
// Auto-discovered + compiled because it sits in the term/clib/ variant folder; pure libc, so no #link.
// (Same convention as extras/log/terminal/log_term.c.) An Arche `[]char` column lowers to (ptr, len).
#include <time.h>
#include <unistd.h>

void screen_be_clear(void) {
	(void)write(1, "\033[2J\033[H", 7); // clear screen + move cursor home
}

// Draw one line. `row` is available for cursor positioning; the MVP renders lines in row order, one per line.
void screen_be_line(int row, const char *s, int n) {
	(void)row;
	(void)write(1, s, (size_t)n);
	(void)write(1, "\n", 1);
}

// Pace one frame (~16ms → ~60fps) so the native reactor loop yields the CPU instead of busy-spinning.
void screen_be_present(void) {
	struct timespec ts = {0, 16000000};
	nanosleep(&ts, NULL);
}
