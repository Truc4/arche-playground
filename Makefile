# arche-playground — Arche UI components (a `term` device to start), each a DUMB device whose content lives in
# the WORLD, with interchangeable backends. The SAME program runs two ways:
#   make dev    → NATIVELY in your terminal (the clib backend) — no browser
#   make serve  → in the browser (the dom backend + the in-browser Arche toolchain)
# "The playground isn't just for wasm": wasm/dom is one backend; clib/native is the other.
#
# Quick start:
#   make dev            # run src/$(APP).arche natively via the clib backend → your terminal
#   make serve          # build the browser toolchain (if needed) + serve → http://localhost:8000
#   make build          # (re)build the compiler + analyzer wasm + core/stdlib bundle from source

# ARCHE: the native arche compiler (for `make dev`). ARCHE_SRC: compiler source (for the browser toolchain).
# APP: src/$(APP).arche is the driver `make dev` runs.
ARCHE        ?= ../arche/build/arche
ARCHE_SRC    ?= ../arche
WASI_SYSROOT ?= /usr/share/wasi-sysroot
PORT         ?= 8000
APP          ?= demo

TOOLCHAIN := www/analyzer/arche-compile.wasm www/analyzer/arche-analyzer.wasm www/analyzer/arche-fs.json

.PHONY: all build serve dev clean

all: build

# Run the demo NATIVELY in the terminal — the term device's clib backend renders straight to your tty (no
# browser, no wasm). `arche run` hot-reloads: edit src/$(APP).arche and it recompiles + reruns.
dev:
	ARCHE_SELECT=screen=clib $(ARCHE) run src/$(APP).arche

# Build the in-browser toolchain (compiler + analyzer wasm + the core/stdlib bundle) from $(ARCHE_SRC).
build:
	ARCHE_SRC="$(ARCHE_SRC)" WASI_SYSROOT="$(WASI_SYSROOT)" sh scripts/build-toolchain.sh

# The toolchain wasm is a build artifact (gitignored), so `make serve` auto-builds it if it's missing.
$(TOOLCHAIN):
	$(MAKE) build

# Build (if missing) then serve the browser playground statically — open http://localhost:$(PORT).
serve: $(TOOLCHAIN)
	python3 -m http.server $(PORT) -d www

clean:
	rm -f $(TOOLCHAIN)
