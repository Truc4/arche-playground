# arche-playground/playground — the COMPOSED app: an EDITOR pane + a compiler + a TERMINAL/screen output pane
# in ONE gfx window. Edit Arche code, press Ctrl-R to compile+run, see the output below.
#
# The playground is a real APP: `make dev` BUILDS it into a standalone binary (release codegen) and runs THAT —
# NOT `arche run` (the dev hot-reload loop, which can't host the compiler subprocess the app spawns on Ctrl-R).
# To run your code, the built app shells out to a compiler (ARCHE_BIN) — a separate dependency, like a C
# playground shelling out to gcc. Composes the sibling editor/ + terminal/ components + its own compiler device.

# Prefer an installed `arche` on PATH (the packaged compiler dependency); fall back to the dev build tree.
ARCHE ?= $(shell command -v arche 2>/dev/null || echo ../../arche/build/arche)
BUILD ?= build
PORT  ?= 8000
SEL   := --select gfx=x11 --select editor=window --select screen=window --select compiler=clib
# Browser: same source, gfx=wasm canvas + the compiler wasm host (compiles in-browser, no subprocess).
WSEL  := --arch=wasm32 --select editor=dom --select screen=dom --select compiler=wasm
# Toolchain the in-browser compiler host needs (built by the root `make toolchain`; copied from ../www).
WWWDEPS := www/wasi.js www/analyzer/wasi-fs.js www/analyzer/arche-compile.wasm www/analyzer/arche-fs.json

.PHONY: dev serve clean

# Build the app to a standalone binary, then run it. ARCHE_BIN is the compiler the app invokes for USER code.
dev: $(BUILD)/playground
	ARCHE_BIN=$(abspath $(ARCHE)) $(BUILD)/playground

# Native uses the gfx-window driver (src/window.arche) + the framebuffer backends (the one combo that needs gfx).
$(BUILD)/playground: src/window.arche $(shell find devices -type f 2>/dev/null)
	@mkdir -p $(BUILD)
	$(ARCHE) build $(SEL) -o $@ src/window.arche

# Browser: the BACKEND-AGNOSTIC driver (src/playground.arche, no gfx) with the DOM backends — a real <textarea>
# + <pre> + the in-process compiler host. `arche build --arch=wasm32` emits playground.wasm + .hosts.js + arche-web.js.
serve: www/playground.wasm $(WWWDEPS)
	python3 ../dev-server.py $(PORT) www

www/playground.wasm: src/playground.arche $(shell find devices -type f 2>/dev/null)
	$(ARCHE) build $(WSEL) -o $@ src/playground.arche

www/wasi.js: ../www/runtime/wasi.js
	@mkdir -p www; cp $< $@
www/analyzer/%: ../www/analyzer/%
	@mkdir -p www/analyzer; cp $< $@

clean:
	rm -rf $(BUILD)
	rm -f www/*.wasm www/*.hosts.js www/arche-web.js www/wasi.js
	rm -rf www/analyzer
