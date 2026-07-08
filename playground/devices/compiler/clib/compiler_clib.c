// Native backend for the `compiler` device: write the source to a temp .arche file, shell out to `arche run`
// on it, and capture the program's stdout+stderr into the caller's buffer. Pure libc (no #link needed).
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

// compiler_be_run(src, n, buf, cap) : src + buf cross as bare in-out pointers; buf is the caller-allocated OUT,
// written in place and NUL-terminated (the caller scans to the terminator — no separate length out).
void compiler_be_run(const char *src, int n, char *buf, int cap) {
	if (cap <= 0)
		return;
	if (n <= 0) // convenience for NUL-terminated literals: use the string length
		n = (int)strlen(src);

	char path[] = "/tmp/arche_pg_XXXXXX";
	int fd = mkstemp(path);
	if (fd < 0) {
		snprintf(buf, (size_t)cap, "error: could not create temp file\n");
		return;
	}
	if (write(fd, src, (size_t)n) != (ssize_t)n) {
		close(fd);
		unlink(path);
		snprintf(buf, (size_t)cap, "error: could not write source\n");
		return;
	}
	close(fd);

	// arche wants a `.arche` extension to recognise the source.
	char apath[300];
	snprintf(apath, sizeof apath, "%s.arche", path);
	if (rename(path, apath) != 0) {
		unlink(path);
		snprintf(buf, (size_t)cap, "error: could not stage source\n");
		return;
	}

	const char *bin = getenv("ARCHE_BIN");
	if (!bin || !*bin)
		bin = "arche";
	char cmd[512];
	snprintf(cmd, sizeof cmd, "%s run %s 2>&1", bin, apath);

	FILE *p = popen(cmd, "r");
	if (!p) {
		unlink(apath);
		snprintf(buf, (size_t)cap, "error: could not launch the compiler\n");
		return;
	}
	size_t r = fread(buf, 1, (size_t)(cap - 1), p);
	buf[r] = 0; // NUL-terminate so the caller can scan
	pclose(p);
	unlink(apath);
}
