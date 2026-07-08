# arche-playground — the GUI that COMPOSES the components: write Arche in an editor, compile it in the browser
# (the Arche compiler + analyzer are themselves WebAssembly), and run it. No server.
#
#   make serve      # build the in-browser toolchain (if needed) + serve → http://localhost:8000
#   make toolchain  # (re)build the compiler + analyzer wasm + core/stdlib bundle from ../arche
#
# The reusable UI components live in decoupled subdirs — each with its OWN Makefile + demo:
#   terminal/  — the `screen` display device (clib + dom)            → make -C terminal dev|serve
#   editor/    — the `editor` device (<textarea> / vendored kilo)    → make -C editor  dev|serve
# (or use the delegating targets below). Everything depends only on ../arche.

ARCHE_SRC    ?= ../arche
WASI_SYSROOT ?= /usr/share/wasi-sysroot
PORT         ?= 8000

TOOLCHAIN := www/analyzer/arche-compile.wasm www/analyzer/arche-analyzer.wasm www/analyzer/arche-fs.json

.PHONY: all serve toolchain clean terminal editor

all: serve

# Delegate to the components (run their demos). Override the port to run several at once, e.g. PORT=8001.
terminal:
	$(MAKE) -C terminal serve PORT=$(PORT)
editor:
	$(MAKE) -C editor serve PORT=$(PORT)

# Build the in-browser toolchain (if missing) then serve the playground GUI statically.
serve: $(TOOLCHAIN)
	python3 -m http.server $(PORT) -d www

# The compiler/analyzer wasm + core/stdlib bundle are build artifacts (gitignored); rebuild from source.
toolchain: $(TOOLCHAIN)
$(TOOLCHAIN):
	ARCHE_SRC="$(ARCHE_SRC)" WASI_SYSROOT="$(WASI_SYSROOT)" sh scripts/build-toolchain.sh

clean:
	rm -f $(TOOLCHAIN)
