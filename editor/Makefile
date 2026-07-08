# arche-editor — a text-EDITOR device with real backends. Same program, three ways:
#   make dev      → a native gfx WINDOW    (window backend: edits a framebuffer via gfx.key + a cursor)
#   make dev-tty  → straight to the tty     (clib: a vendored kilo-style editor)
#   make serve    → in the browser          (dom: a native <textarea>)
# Depends only on ../arche.

ARCHE ?= ../../arche/build/arche
PORT  ?= 8000
APP   ?= demo

.PHONY: dev dev-tty serve clean

# Native: the editor rendered into a gfx X11 WINDOW — type to append, Backspace to delete, a cursor bar.
# Same rendering path as the browser canvas (gfx=wasm). `arche run` hot-reloads on edit.
dev:
	ARCHE_SELECT=gfx=x11,editor=window $(ARCHE) run src/window.arche

# Native TTY: the clib backend runs the vendored kilo editor in the terminal (no window).
dev-tty:
	ARCHE_SELECT=editor=clib $(ARCHE) run src/$(APP).arche

www/$(APP).wasm: src/$(APP).arche $(wildcard devices/editor/dom/*) devices/editor/editor.ds.arche
	$(ARCHE) build --arch=wasm32 --select editor=dom -o $@ src/$(APP).arche

serve: www/$(APP).wasm
	python3 ../dev-server.py $(PORT) www

clean:
	rm -f www/*.wasm www/*.hosts.js www/arche-web.js
