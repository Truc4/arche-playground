# arche-playground — Arche UI components (a `screen` device to start), each a DUMB device whose content lives
# in the WORLD, with interchangeable backends. `make dev` and `make serve` run the SAME program
# (src/$(APP).arche) — only the backend differs:
#   make dev    → NATIVELY in your terminal   (the screen clib backend) — no browser
#   make serve  → in the browser              (the screen dom backend, compiled to wasm)
# "The playground isn't just for wasm": dom/wasm is one backend; clib/native is the other.
#
# Quick start:
#   make dev            # run src/$(APP).arche natively via the clib backend → your terminal
#   make serve          # build src/$(APP).arche to wasm (dom) + serve → http://localhost:8000
#   make toolchain      # (re)build the in-browser compiler/analyzer wasm used by editor.html

# ARCHE: the native arche compiler. ARCHE_SRC: compiler source (for the browser toolchain).
# APP: src/$(APP).arche is the program both `make dev` and `make serve` run.
ARCHE        ?= ../arche/build/arche
ARCHE_SRC    ?= ../arche
WASI_SYSROOT ?= /usr/share/wasi-sysroot
PORT         ?= 8000
APP          ?= editor

TOOLCHAIN := www/analyzer/arche-compile.wasm www/analyzer/arche-analyzer.wasm www/analyzer/arche-fs.json

.PHONY: all serve dev toolchain clean

all: serve

# Run the program NATIVELY in the terminal — the screen device's clib backend renders straight to your tty
# (no browser, no wasm). `arche run` hot-reloads: edit src/$(APP).arche and it recompiles + reruns.
dev:
	ARCHE_SELECT=screen=clib $(ARCHE) run src/$(APP).arche

# The SAME program, compiled to wasm with the screen DOM backend. screen_be_* become wasm imports the JS host
# (devices/screen/dom/host.js, collected + emitted as demo.hosts.js) fulfils. Rebuilt whenever the program or
# the dom backend changes.
www/demo.wasm: src/$(APP).arche devices/screen/dom/backend.arche devices/screen/dom/host.js devices/screen/screen.ds.arche
	$(ARCHE) build --arch=wasm32 --select screen=dom -o $@ src/$(APP).arche

# Build the browser twin of `make dev`, then serve it — open http://localhost:$(PORT).
serve: www/demo.wasm
	python3 -m http.server $(PORT) -d www

# The in-browser compiler/analyzer toolchain used by editor.html (a separate, heavier app). Gitignored
# artifacts, so this rebuilds them from $(ARCHE_SRC) on demand.
toolchain: $(TOOLCHAIN)
$(TOOLCHAIN):
	ARCHE_SRC="$(ARCHE_SRC)" WASI_SYSROOT="$(WASI_SYSROOT)" sh scripts/build-toolchain.sh

clean:
	rm -f www/demo.wasm $(TOOLCHAIN)
