// Native backend for the `compiler` device: write the source to a temp .arche file, shell out to `arche run`
// on it, and capture the program's stdout+stderr into the caller's buffer. Pure libc (no #link needed).
//
// SELF-CONTAINED: it finds the `arche` binary without relying on $PATH — ARCHE_BIN if set, else a bundled `arche`
// sitting next to the running executable (vendor one there to ship the device standalone), else PATH as a last
// resort.
//
// KNOWN LIMITATION: this popen()s a subprocess, and Arche's `arche run` HOT-RELOAD runtime stack-overflows the
// moment the running app spawns a subprocess — so an app that embeds this device must be BUILT and run, not
// launched via `arche run`. (See the portfolio's `make dev`, which builds a binary then runs it.) The browser
// backend has no such issue — it compiles in-process via arche-compile.wasm.
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

// Resolve the `arche` binary to use: explicit ARCHE_BIN → a bundled `arche` beside this executable → $PATH.
static void find_arche(char *out, size_t cap) {
	const char *env = getenv("ARCHE_BIN");
	if (env && *env) {
		snprintf(out, cap, "%s", env);
		return;
	}
	char exe[PATH_MAX];
	ssize_t k = readlink("/proc/self/exe", exe, sizeof exe - 1);
	if (k > 0) {
		exe[k] = 0;
		char *slash = strrchr(exe, '/');
		if (slash) {
			*slash = 0;
			char cand[PATH_MAX];
			snprintf(cand, sizeof cand, "%s/arche", exe);
			if (access(cand, X_OK) == 0) {
				snprintf(out, cap, "%s", cand);
				return;
			}
		}
	}
	snprintf(out, cap, "arche");
}

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

	char bin[PATH_MAX];
	find_arche(bin, sizeof bin);
	char cmd[PATH_MAX + 128];
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
