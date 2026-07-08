# arche-playground/playground — the COMPOSED app: an EDITOR pane + a compiler + a TERMINAL/screen output pane
# in ONE gfx window. Edit Arche code, press Ctrl-R to compile+run, see the output below.
#   make dev   → native gfx window (editor=window, screen=window, compiler=clib)
# Composes the sibling editor/ + terminal/ components + its own compiler device. Depends only on ../../arche.

ARCHE ?= ../../arche/build/arche

.PHONY: dev clean

# ARCHE_BIN lets the compiler device's shim find `arche` for its `popen(... run ...)`. `arche run` hot-reloads.
dev:
	ARCHE_BIN=$(abspath $(ARCHE)) \
	ARCHE_SELECT=gfx=x11,editor=window,screen=window,compiler=clib \
	$(ARCHE) run src/playground.arche

clean:
	rm -f www/*.wasm www/*.hosts.js www/arche-web.js
