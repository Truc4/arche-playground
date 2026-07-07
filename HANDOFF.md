# arche-playground — session handoff (2026-07-07)

> Next session is on a different PC. This file carries the plan + working notes that normally live in
> `~/.claude`. **Both `arche` and `arche-playground` have uncommitted changes — commit + push both repos
> before switching machines, or this work is lost.** (Arche compiler changes are the big ones.)

## The big picture (what we're building)

UI as Arche **devices**: dumb, world-driven, with interchangeable backends. Each capability is a device whose
content lives in the WORLD (archetype columns) and whose backends render/serve it — **clib** natively,
**dom** in the browser. The SAME Arche program runs both ways; only the selected backend differs. Goal: the
playground (editor, terminal) is built from such components and runs natively (`make dev`) or in the browser
(`make serve`).

Related earlier work (see also the `arche-wasm` repo): Arche has a **direct HIR→wasm codegen backend**
(`wasmgen`, no LLVM) — `~47%` of language tests; the playground compiles Arche client-side. That's separate
from the device/host work below.

## DONE + verified this session — Part A: devices SHIP their browser host (turnkey)

Fixed a real asymmetry: the native backend ships its `.c` shim inside the device (auto-linked), but browser
hosts were **copy-pasted per app** (`arche-wasm/www/gfx.js` == `arche-playground/www/runtime/gfx.js`). Now a
device ships `host.js` next to `backend.arche`, and the **compiler collects + emits it**, symmetric with `.c`.

- **arche (compiler):**
  - `compile/module_resolve.{c,h}` — new `add_js_host` callback (parallel to `add_c_shim`) collects `.js` from
    device/variant folders.
  - `compile/compile.c` — `g_js_hosts[]`; after a wasm link, emits `<out>.hosts.js` (selected hosts,
    concatenated) and copies `runtime/arche-web.js` next to the `.wasm`. (`copy_file` helper.)
  - `runtime/arche-web.js` (NEW) — self-contained browser runtime: bundled WASI shim + assembles `archeHosts`
    seams into `env` (+ base `log_be_emit`→console for panics) + **drives by shape**: reactor (`arche_frame`)
    via rAF, or command (`_start`) once.
  - `Makefile` — stages `runtime/arche-web.js` → `build/runtime/` so `arche_resource_dir(RUNTIME)` finds it.
  - `arche_analyzer.c` — resolver init got the extra `NULL` for the new callback.
- **arche-playground:**
  - `devices/screen/dom/host.js` (NEW) — the screen dom host in `archeHosts` form (replaces hand-written
    `www/screen.js`, now deleted).
  - `www/index.html` — turnkey: loads only emitted `arche-web.js` + `demo.hosts.js` + `demo.wasm`.
  - `.gitignore` — ignores emitted `www/*.hosts.js`, `www/arche-web.js`, `www/*.wasm`.

**Host convention** (device authors write this once, next to `backend.arche`):
```js
(globalThis.archeHosts ??= []).push({
  bind(rt) { /* one-time: rt.root (DOM el), keydown listeners */ },
  seams(rt) { return { dev_be_x() {…} }; },   // env imports; use rt.memory() (set post-instantiate)
});
```
App page becomes: `<script src=arche-web.js><script src=X.hosts.js><script>archeRun("X.wasm")</script>`.

**Verified:** `arche build --arch=wasm32 --select screen=dom -o www/demo.wasm src/demo.arche` emits
`demo.wasm` + `demo.hosts.js` + `arche-web.js`; the browser renders the demo with **no hand-written host**
(`handWrittenHost:false`). Also node-verified.

## IN PROGRESS — Part B: the text editor (single-line MVP)

Composes `term` (input) + `screen` (display) + world edit state, as a REACTOR (poll→edit→render/frame).

- `src/editor.arche` (NEW) — **compiles natively (exit 0).** Reactor: `init` (term.raw_enable + seed empty
  Line) → `forever(seq({ input, screen.render, done }))`. `input` polls `term.read_key()` (non-blocking byte),
  appends printable / Backspace-deletes / Esc→`insert(Closed)`. `done :: map (Closed) { term.raw_restore;
  os.exit(0) }`.
- **Native input is free:** stdlib `term` (`runtime/term.c`, termios, non-blocking `read_key`) is auto-linked.
- `stdlib/term/host.js` — **DONE** (browser term host: keydown→queue→`term_read_key`; exposes `rt.termQueue`
  for headless drivers). Collected via Part A — `editor.wasm` imports term+screen seams, exports
  `arche_run`+`arche_frame` (a reactor). Node-drive test confirmed frames run + Esc stops the loop.
- **⚠️ ACTIVE BUG (fix first next session):** the edit output is wrong — typing `hello` renders `"h\0\0\0e"`,
  the **stride-4 signature**. `tstr :: [64]char`; `tstr[tlen] = k` writes at byte `tlen*4` (char columns are
  4 bytes/char here) but `screen.render`→`screen_be_line(row,ptr,n)` passes `n = tlen` as a **byte** count, so
  the host decodes bytes `0..tlen` and sees `h·0·0·0·e`. So: a queried `[N]char` column strides by 4, but the
  length is treated as bytes. Reconcile: either `char` should be 1 byte (check `byte` vs `char` — the passing
  `byte_array_buffer` test used a LOCAL `[4]byte`, not a queried char column), or the render must pass a
  BYTE length (`tlen * sizeof(char)`) and the host decode accordingly. Repro: `arche build --arch=wasm32
  --select screen=dom -o /tmp/ed/editor.wasm src/editor.arche`, then node-drive pushing bytes to `rt.termQueue`
  and stepping the captured rAF tick.
- **Remaining Part B (after the bug):**
  2. `screen_be_present()` seam for native pacing — add to `devices/screen/{clib,dom}/backend.arche`, call at
     end of `render`; `screen_clib.c` does `nanosleep(~16ms)`; the dom host no-ops (rAF paces). Without it the
     native reactor busy-loops at 100% CPU.
  3. `Makefile`: set `APP ?= editor` so `make dev`/`make serve` target the editor.
  4. Verify: `make dev` (type in a real terminal → line grows, Backspace shrinks, Esc restores tty + exits);
     `make serve` (same in browser, driven by rAF). Reactor wasm must export `arche_run`+`arche_frame`.
     Node-drive test: instantiate the reactor wasm, push synthetic key bytes to the term host queue, call
     `arche_frame` a few times, assert the screen updates.

## TODO — Part A4 (cleanup): migrate existing hosts, kill duplication
Move `arche-wasm/www/gfx.js`, `text.js` into `extras/gfx/wasm/host.js`, `extras/text/dom/host.js`,
`extras/log/wasm/host.js` (archeHosts form); delete the duplicated `arche-*/www/*.js`; verify arche-wasm
demos still run. `log_be_emit` is now defaulted by `arche-web.js`, so a bare `log` may not even need a host.

## Commands / verification
- Native editor: `cd arche-playground && make dev` (currently `APP=demo`; set `APP=editor` or
  `make dev APP=editor`). Runs `ARCHE_SELECT=screen=clib arche run src/$(APP).arche`.
- Browser: `make serve` → builds `www/$(APP).wasm` (screen=dom) + emits hosts + runtime → serve www/.
- Compiler build: `cd arche && make build/arche`.
- The screen demo (run-once, no editor) stays at `src/demo.arche` — `make dev APP=demo`.

## Files touched (uncommitted — COMMIT BOTH REPOS)
- **arche:** `compile/module_resolve.{c,h}`, `compile/compile.c`, `arche_analyzer.c`, `Makefile`,
  `runtime/arche-web.js` (new). (Plus earlier `wasmgen`/`wasm_encode`/`tests/wasm/*` from the direct-wasm work.)
- **arche-playground:** `devices/screen/` (+ dom/host.js), `src/{demo,editor}.arche`, `arche.toml`, `Makefile`,
  `scripts/{build-toolchain.sh,gen-fs.mjs}`, `www/{index.html,editor.html,screen.js(deleted),runtime/*}`,
  `.gitignore`.
