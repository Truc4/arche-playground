# arche-playground

A browser IDE for **Arche**: write code, compile it (server-side), and run the result in the browser —
compute programs print to a text pane, `gfx` programs draw to a WebGL canvas. The app shell that composes
the editor, terminal, and run harness; the eventual foundation of the site.

## Status — M1 (the loop) working

Edit → **compile** (via [arche-compile-service](../arche-compile-service)) → **run** (the vendored
arche-wasm harness) → output. Compute (`_start`→stdout), gfx (`arche_run`/`arche_frame`→canvas), and inline
compile diagnostics all work end-to-end.

## Run

```sh
# 1. start the compile service (separate repo)
cd ../arche-compile-service && node server.js      # :8791

# 2. serve this folder statically
python3 -m http.server 8130 -d www                 # open http://localhost:8130
#    (point at another compile service with ?compile=<url>)
```

## Layout

- `www/index.html`, `www/app.js` — the page + wiring (editor → /compile → run).
- `www/runtime/` — the run harness, **vendored from arche-wasm** (`wasi.js`, `gfx.js`, `text.js`) plus
  `run.js` = a generic `runProgram(bytes)` that detects mode from exports (`arche_frame` ⇒ gfx, else
  `_start` ⇒ compute) and drives the right runner. `gfx.js` is patched to render at the module's OWN
  requested size (a generic runner can't impose a window-aspect width).

## Roadmap (see the plan)

- **M1 remaining:** CodeMirror editor (currently a textarea); **Web Worker + wall-clock watchdog** and a
  **compile sandbox** for untrusted/public use.
- **M2:** a terminal (libvterm→wasm) rendered via the `text` device — its own repo `arche-term`.
- **M3:** live diagnostics + semantic highlighting from `arche-analyzer`.
- **M4:** a C editor (kilo→wasm) in the terminal — `arche-edit`.
- **M5:** reimplement the terminal + editor **in Arche** on the `gfx`/`text` devices (the dogfood endgame).

Each component (`arche-term`, `arche-edit`) is a general-purpose library that also targets wasm — not a
wasm-specific thing — mirroring how the `gfx`/`text` devices are backend-selectable.
