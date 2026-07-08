# arche-editor — a text-EDITOR device with two real backends. Same program, two ways:
#   make dev    → NATIVELY in your terminal   (clib: a vendored kilo-style editor)
#   make serve  → in the browser              (dom: a native <textarea>)
# Depends only on ../arche.

ARCHE ?= ../../arche/build/arche
PORT  ?= 8000
APP   ?= demo

.PHONY: dev serve clean

dev:
	ARCHE_SELECT=editor=clib $(ARCHE) run src/$(APP).arche

www/$(APP).wasm: src/$(APP).arche $(wildcard devices/editor/dom/*) devices/editor/editor.ds.arche
	$(ARCHE) build --arch=wasm32 --select editor=dom -o $@ src/$(APP).arche

serve: www/$(APP).wasm
	python3 ../dev-server.py $(PORT) www

clean:
	rm -f www/*.wasm www/*.hosts.js www/arche-web.js
