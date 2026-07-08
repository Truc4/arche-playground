# arche-playground — the COMPOSED app: an editor pane + a terminal pane + a compiler, in one window.
#
#   make dev        # NATIVE: the composed playground in a gfx window — edit Arche, Ctrl-R to compile+run
#   make serve      # BROWSER (old GUI, being replaced): in-browser compiler → http://localhost:8000
#   make toolchain  # (re)build the compiler + analyzer wasm + core/stdlib bundle from ../arche
#
# The pieces live in decoupled subdirs — each with its OWN Makefile + demo:
#   playground/ — the composed app (editor + screen + compiler devices)  → make -C playground dev
#   terminal/   — the `screen` display device (window / clib / dom)       → make -C terminal dev|serve
#   editor/     — the `editor` device (window / clib / dom)               → make -C editor  dev|serve
# (or use the delegating targets below). Everything depends only on ../arche.

ARCHE_SRC    ?= ../arche
WASI_SYSROOT ?= /usr/share/wasi-sysroot
PORT         ?= 8000

TOOLCHAIN := www/analyzer/arche-compile.wasm www/analyzer/arche-analyzer.wasm www/analyzer/arche-fs.json

.PHONY: all dev serve toolchain clean terminal editor

all: dev

# Native: the COMPOSED playground (editor + terminal + compiler) in a gfx window — edit, Ctrl-R to run.
dev:
	$(MAKE) -C playground dev

# Delegate to the components (run their demos). Override the port to run several at once, e.g. PORT=8001.
terminal:
	$(MAKE) -C terminal serve PORT=$(PORT)
editor:
	$(MAKE) -C editor serve PORT=$(PORT)

# Browser: the COMPOSED playground (editor=dom + screen=dom + compiler=wasm) — a real <textarea> + <pre> + the
# in-browser compiler. Build the toolchain the compiler host runs (if missing), then delegate to playground/.
serve: $(TOOLCHAIN)
	$(MAKE) -C playground serve PORT=$(PORT)

# The compiler/analyzer wasm + core/stdlib bundle are build artifacts (gitignored); rebuild from source.
toolchain: $(TOOLCHAIN)
$(TOOLCHAIN):
	ARCHE_SRC="$(ARCHE_SRC)" WASI_SYSROOT="$(WASI_SYSROOT)" sh scripts/build-toolchain.sh

clean:
	rm -f $(TOOLCHAIN)
