// editor_clib.c — the `editor` device's clib backend: a small self-contained terminal text editor (kilo-style),
// auto-compiled from this variant folder. Pure libc + termios, no deps, no #link. `editor_be_open` raw-modes
// the tty and runs a modal edit loop until Ctrl-Q. A single growable gap-free buffer of bytes (newlines
// included); cursor is a byte index; the screen is redrawn each keystroke. This is the vendored-C-editor twin
// of the dom backend's <textarea>; swap in the full upstream `kilo.c` here to grow it (syntax, files, etc.).
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <termios.h>
#include <unistd.h>

#define EDCTRL(k) ((k) & 0x1f)

static struct termios g_orig;
static int g_raw = 0;

static void raw_off(void) {
	if (g_raw) { tcsetattr(STDIN_FILENO, TCSANOW, &g_orig); g_raw = 0; }
}
static void raw_on(void) {
	if (!isatty(STDIN_FILENO)) return;
	tcgetattr(STDIN_FILENO, &g_orig);
	struct termios raw = g_orig;
	raw.c_lflag &= ~(ICANON | ECHO | ISIG | IEXTEN);
	raw.c_iflag &= ~(IXON | ICRNL);
	raw.c_oflag &= ~(OPOST);
	raw.c_cc[VMIN] = 1;
	raw.c_cc[VTIME] = 0;
	tcsetattr(STDIN_FILENO, TCSANOW, &raw);
	g_raw = 1;
}

// Redraw the whole buffer + a status line, then place the terminal cursor at byte index `cur`.
static void redraw(const char *buf, int len, int cur) {
	char out[1 << 16];
	int o = 0;
	o += snprintf(out + o, sizeof(out) - o, "\033[2J\033[H"); // clear + home
	int row = 1, col = 1, crow = 1, ccol = 1;
	for (int i = 0; i < len && o < (int)sizeof(out) - 8; i++) {
		if (i == cur) { crow = row; ccol = col; }
		if (buf[i] == '\n') { out[o++] = '\r'; out[o++] = '\n'; row++; col = 1; }
		else { out[o++] = buf[i]; col++; }
	}
	if (cur >= len) { crow = row; ccol = col; }
	o += snprintf(out + o, sizeof(out) - o, "\033[999;1H\033[7m -- editor (Ctrl-Q quit) -- \033[m\033[%d;%dH", crow, ccol);
	(void)write(STDOUT_FILENO, out, (size_t)o);
}

void editor_be_open(void) {
	raw_on();
	int cap = 256, len = 0, cur = 0;
	char *buf = malloc(cap);
	redraw(buf, len, cur);
	for (;;) {
		char c;
		if (read(STDIN_FILENO, &c, 1) != 1) break;
		if (c == EDCTRL('q')) break;
		if (c == '\033') { // arrow keys: ESC [ A/B/C/D — handle left/right
			char s[2];
			if (read(STDIN_FILENO, &s[0], 1) == 1 && s[0] == '[' && read(STDIN_FILENO, &s[1], 1) == 1) {
				if (s[1] == 'C' && cur < len) cur++;        // right
				else if (s[1] == 'D' && cur > 0) cur--;     // left
			}
		} else if (c == 127 || c == 8) { // backspace
			if (cur > 0) { memmove(buf + cur - 1, buf + cur, (size_t)(len - cur)); len--; cur--; }
		} else if (c == '\r' || c == '\n' || (c >= 32 && c < 127)) {
			if (len + 1 >= cap) { cap *= 2; buf = realloc(buf, cap); }
			memmove(buf + cur + 1, buf + cur, (size_t)(len - cur));
			buf[cur] = (c == '\r') ? '\n' : c;
			len++; cur++;
		}
		redraw(buf, len, cur);
	}
	raw_off();
	(void)write(STDOUT_FILENO, "\033[2J\033[H", 7);
	free(buf);
}
