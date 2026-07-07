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
  const _dec = new TextDecoder();
  // Host-side printf matching C output. Args are 8-byte slots: i32 in the low 4 bytes, or an f64, or {ptr,len}
  // for %s. Handles flags/width/precision for d/i/u/x/X/o/f/F/e/E/g/G/c/s/%. Mirrors tests/wasm/run-one.mjs.
  function fmtPrintf(mem, fp, fl, ap) {
    const dv = new DataView(mem.buffer);
    const fmt = _dec.decode(new Uint8Array(mem.buffer).subarray(fp, fp + fl));
    let ai = 0;
    const I = () => dv.getInt32(ap + ai++ * 8, true);
    const U = () => dv.getUint32(ap + ai++ * 8, true) >>> 0;
    const F = () => dv.getFloat64(ap + ai++ * 8, true);
    const S = () => { const p = dv.getInt32(ap + ai * 8, true), l = dv.getInt32(ap + ai * 8 + 4, true); ai++; return _dec.decode(new Uint8Array(mem.buffer).subarray(p, p + l)); };
    const pad = (str, flags, width) => {
      if (str.length >= width) return str;
      if (flags.includes("-")) return str + " ".repeat(width - str.length);
      const fill = flags.includes("0") ? "0" : " ", p = fill.repeat(width - str.length);
      return fill === "0" && (str[0] === "-" || str[0] === "+") ? str[0] + p + str.slice(1) : p + str;
    };
    const sign = (neg, flags) => (neg ? "-" : flags.includes("+") ? "+" : flags.includes(" ") ? " " : "");
    return fmt.replace(/%([-+ 0#]*)(\d+)?(?:\.(\d+))?(?:hh|h|ll|l|L|z|j|t)?([diouxXeEfFgGcs%])/g, (_, flags, w, p, spec) => {
      const width = w ? +w : 0, prec = p !== undefined ? +p : undefined;
      if (spec === "%") return "%";
      if (spec === "s") return pad(S(), flags, width);
      if (spec === "c") return pad(String.fromCharCode(I() & 0xff), flags, width);
      if (spec === "d" || spec === "i") { const v = I(); let d = Math.abs(v).toString(); if (prec !== undefined) d = d.padStart(prec, "0"); return pad(sign(v < 0, flags) + d, flags, width); }
      if (spec === "u") return pad(U().toString(), flags, width);
      if (spec === "x" || spec === "X") { let h = U().toString(16); if (spec === "X") h = h.toUpperCase(); if (prec !== undefined) h = h.padStart(prec, "0"); if (flags.includes("#") && h !== "0") h = (spec === "X" ? "0X" : "0x") + h; return pad(h, flags, width); }
      if (spec === "o") { let o = U().toString(8); if (prec !== undefined) o = o.padStart(prec, "0"); return pad(o, flags, width); }
      const f = F();
      if (spec === "f" || spec === "F") return pad(sign(f < 0, flags) + Math.abs(f).toFixed(prec === undefined ? 6 : prec), flags, width);
      if (spec === "e" || spec === "E") { let v = Math.abs(f).toExponential(prec === undefined ? 6 : prec).replace(/e([+-])(\d)$/, "e$10$2"); if (spec === "E") v = v.toUpperCase(); return pad(sign(f < 0, flags) + v, flags, width); }
      return pad(f.toString(), flags, width); // g/G approximate
    });
  }

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
      // The direct wasm backend routes fmt.printf → host imports (formatting happens here, not in wasm):
      //   arche_print(ptr,len)                    — a bare string literal
      //   arche_printf(fmtPtr,fmtLen,argsPtr,argc) — a format string + args marshalled as 8-byte slots
      //     (i32 low / f64 / {ptr,len} for %s). C-fidelity flags/width/precision for d/u/x/o/c/f/e/s.
      arche_print(ptr, len) { shim.stdout += dec.decode(new Uint8Array(shim.memory.buffer, ptr, len)); },
      arche_printf(fmtPtr, fmtLen, argsPtr) { shim.stdout += fmtPrintf(shim.memory, fmtPtr, fmtLen, argsPtr); },
    };
    const { instance } = await WebAssembly.instantiate(u8, Object.assign({}, shim.imports, { env }));
    shim.start(instance); // throws on non-zero exit; caller shows it
    if (out) out.textContent = shim.stdout + (shim.stderr ? "\n[stderr] " + shim.stderr : "");
    return { mode: "compute", stdout: shim.stdout, stderr: shim.stderr, stop() {} };
  }

  global.runProgram = runProgram;
})(window);
