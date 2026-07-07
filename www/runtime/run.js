// Generic runner: given a compiled Arche `.wasm`, DETECT its mode from exports and drive the right harness.
//   - a gfx REACTOR exports `arche_frame` (+ `arche_run`) → GfxRunner (WebGL canvas + input).
//   - a compute COMMAND exports `_start` → WasiShim (run once, capture stdout/stderr).
// Returns a handle with `stop()` (gfx needs teardown; compute is one-shot). Depends on the vendored
// WasiShim / GfxRunner / TextLayer globals (load wasi.js, text.js, gfx.js first).
//
// NOTE: runs on the MAIN THREAD for now. Public/untrusted use needs a Web Worker + wall-clock watchdog
// (an infinite loop here hangs the tab) — that's the next isolation step; the API here (runProgram → {stop})
// is written to move behind a worker unchanged.
(function (global) {
  async function runProgram(bytes, { out, canvas }) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const module = await WebAssembly.compile(u8);
    const isGfx = WebAssembly.Module.exports(module).some((e) => e.name === "arche_frame");

    if (isGfx) {
      if (out) out.style.display = "none";
      canvas.style.display = "block"; // NB: "" would revert to the stylesheet's display:none
      const gfx = new global.GfxRunner(canvas);
      await gfx.start(u8);
      return { mode: "gfx", stop() { try { gfx.stop(); } catch {} } };
    }

    // compute: instantiate with the WASI shim + the log seam (panics emit through log_be_emit), run `_start`.
    canvas.style.display = "none";
    if (out) out.style.display = "block";
    const shim = new global.WasiShim(["prog"]);
    const dec = new TextDecoder();
    const env = {
      log_be_emit(level, ptr, len) { shim.stderr += dec.decode(new Uint8Array(shim.memory.buffer, ptr, len)); },
      // The direct wasm backend routes fmt.printf → arche_print(ptr,len) (host-side formatting/output).
      arche_print(ptr, len) { shim.stdout += dec.decode(new Uint8Array(shim.memory.buffer, ptr, len)); },
    };
    const { instance } = await WebAssembly.instantiate(u8, Object.assign({}, shim.imports, { env }));
    shim.start(instance); // throws on non-zero exit; caller shows it
    if (out) out.textContent = shim.stdout + (shim.stderr ? "\n[stderr] " + shim.stderr : "");
    return { mode: "compute", stdout: shim.stdout, stderr: shim.stderr, stop() {} };
  }

  global.runProgram = runProgram;
})(window);
