# arche-terminal — a text-display device (`screen`) with two backends. The SAME program runs both ways:
#   make dev    → NATIVELY in your terminal   (screen clib backend) — no browser
#   make serve  → in the browser              (screen dom backend, compiled to wasm)
# Depends only on ../arche (the compiler + stdlib + the browser runtime it emits).

ARCHE ?= ../../arche/build/arche
PORT  ?= 8000
APP   ?= demo

.PHONY: dev serve clean

# Native: the screen clib backend writes straight to the tty. `arche run` hot-reloads on edit.
dev:
	ARCHE_SELECT=screen=clib $(ARCHE) run src/$(APP).arche

# Browser: compile to wasm with the screen dom backend. `arche build --arch=wasm32` also emits the device
# hosts (<app>.hosts.js) and the arche-web.js runtime next to the .wasm — no hand-written JS.
www/$(APP).wasm: src/$(APP).arche $(wildcard devices/screen/dom/*) devices/screen/screen.ds.arche
	$(ARCHE) build --arch=wasm32 --select screen=dom -o $@ src/$(APP).arche

serve: www/$(APP).wasm
	python3 -m http.server $(PORT) -d www

clean:
	rm -f www/*.wasm www/*.hosts.js www/arche-web.js
