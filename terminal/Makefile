# arche-terminal — a text-display device (`screen`) with backends. The SAME program runs everywhere:
#   make dev      → a native gfx WINDOW    (screen window backend, bitmap glyphs in a framebuffer)
#   make dev-tty  → straight to the tty     (screen clib backend, no window)
#   make serve    → in the browser          (screen dom backend, compiled to wasm)
# Depends only on ../arche (the compiler + stdlib + the browser runtime it emits).

ARCHE ?= ../../arche/build/arche
PORT  ?= 8000
APP   ?= demo

.PHONY: dev dev-tty serve clean

# Native: the screen device rendered into a gfx X11 WINDOW — the same rendering path the browser uses via
# gfx=wasm (bitmap glyphs in a shared framebuffer). `arche run` hot-reloads on edit.
dev:
	ARCHE_SELECT=gfx=x11,screen=window $(ARCHE) run src/window.arche

# Native TTY: the clib backend writes straight to the terminal (no window).
dev-tty:
	ARCHE_SELECT=screen=clib $(ARCHE) run src/$(APP).arche

# Browser: compile to wasm with the screen dom backend. `arche build --arch=wasm32` also emits the device
# hosts (<app>.hosts.js) and the arche-web.js runtime next to the .wasm — no hand-written JS.
www/$(APP).wasm: src/$(APP).arche $(wildcard devices/screen/dom/*) devices/screen/screen.ds.arche
	$(ARCHE) build --arch=wasm32 --select screen=dom -o $@ src/$(APP).arche

serve: www/$(APP).wasm
	python3 ../dev-server.py $(PORT) www

clean:
	rm -f www/*.wasm www/*.hosts.js www/arche-web.js
