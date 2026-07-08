// Browser host for the `compiler` device's wasm backend — SHIPS WITH THE DEVICE, collected into
// <out>.hosts.js by `arche build --arch=wasm32`. Fulfils compiler_be_run by (1) compiling the source with the
// in-browser Arche compiler (arche-compile.wasm) via WasiFS, then (2) running the compiled program and
// capturing its stdout — all IN-PROCESS. This is the browser analog of the native clib backend's `popen arche
// run`; no subprocess, no server. The playground page provides the WasiFS + WasiShim globals (wasi-fs.js,
// wasi.js) and the toolchain (analyzer/arche-compile.wasm + analyzer/arche-fs.json).
//
// Synchronous: compiler_be_run is a plain seam call from the arche program, so it must return synchronously.
// That works because a pre-compiled WebAssembly.Module instantiates synchronously at any size (the compiler
// module is preloaded in bind), and the compiled program is small enough for `new WebAssembly.Module`.
(function () {
  const dec = new TextDecoder();
  const enc = new TextEncoder();

  // C-printf → string, matching the direct wasm backend's arche_printf marshalling (from run.js). Args are
  // 8-byte slots: i32 low / f64 / {ptr,len} for %s.
  function fmtPrintf(mem, fp, fl, ap) {
    const dv = new DataView(mem.buffer);
    const fmt = dec.decode(new Uint8Array(mem.buffer).subarray(fp, fp + fl));
    let ai = 0;
    const I = () => dv.getInt32(ap + ai++ * 8, true);
    const U = () => dv.getUint32(ap + ai++ * 8, true) >>> 0;
    const F = () => dv.getFloat64(ap + ai++ * 8, true);
    const S = () => { const p = dv.getInt32(ap + ai * 8, true), l = dv.getInt32(ap + ai * 8 + 4, true); ai++; return dec.decode(new Uint8Array(mem.buffer).subarray(p, p + l)); };
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
      return pad(f.toString(), flags, width);
    });
  }

  (globalThis.archeHosts ??= []).push({
    bind(rt) {
      // Preload the compiler module + core/stdlib bundle so compiler_be_run can run synchronously later.
      this.ready = false;
      this.loadError = null;
      const base = "analyzer/";
      Promise.all([
        fetch(base + "arche-compile.wasm").then((r) => r.arrayBuffer()).then((b) => WebAssembly.compile(b)),
        fetch(base + "arche-fs.json").then((r) => r.json()),
      ]).then(([mod, manifest]) => { this.compileModule = mod; this.manifest = manifest; this.ready = true; })
        .catch((e) => { this.loadError = String(e && e.message ? e.message : e); });
    },

    seams(rt) {
      const self = this;

      const compileAndRun = (src) => {
        if (!self.ready) return self.loadError ? "compiler failed to load: " + self.loadError : "compiler still loading — try again in a moment";
        // 1) compile src -> out.wasm (WasiFS.run is synchronous once the module is compiled)
        let outWasm, cerr, code;
        try {
          const wasi = new WasiFS(self.manifest, { args: ["arche-compile"], env: { ARCHE_WASMGEN: "1", ARCHE_CORE_DIR: "/core", ARCHE_STDLIB_DIR: "/stdlib" } });
          wasi.writeFile("/work/in.arche", src);
          code = wasi.run(self.compileModule);
          outWasm = wasi.readFile("/work/out.wasm");
          cerr = wasi.stderr;
        } catch (e) { return "compiler crashed: " + (e && e.message ? e.message : e); }
        if (code !== 0 || !outWasm) return cerr || "compile failed";

        // 2) run out.wasm, capturing stdout (sync: pre-compiled module instantiates synchronously)
        try {
          const module = new WebAssembly.Module(outWasm);
          const shim = new WasiShim(["prog"]);
          const env = {
            log_be_emit(_level, ptr, len) { shim.stderr += dec.decode(new Uint8Array(shim.memory.buffer, ptr, len)); },
            arche_print(ptr, len) { shim.stdout += dec.decode(new Uint8Array(shim.memory.buffer, ptr, len)); },
            arche_printf(fmtPtr, fmtLen, argsPtr) { shim.stdout += fmtPrintf(shim.memory, fmtPtr, fmtLen, argsPtr); },
          };
          const instance = new WebAssembly.Instance(module, Object.assign({}, shim.imports, { env }));
          shim.start(instance);
          return shim.stdout + (shim.stderr ? "\n[stderr] " + shim.stderr : "");
        } catch (e) { return "run error: " + (e && e.message ? e.message : e); }
      };

      return {
        // compiler_be_run(srcPtr, n, bufPtr, cap): src + buf cross as bare in-out pointers (i32). Write the
        // program's NUL-terminated output into buf. Same signature as the native clib shim.
        compiler_be_run(srcPtr, n, bufPtr, cap) {
          const mem = rt.memory();
          const src = dec.decode(new Uint8Array(mem.buffer, srcPtr, n));
          const bytes = enc.encode(compileAndRun(src));
          const k = Math.min(bytes.length, cap - 1);
          new Uint8Array(mem.buffer, bufPtr, cap).set(bytes.subarray(0, k));
          new Uint8Array(mem.buffer)[bufPtr + k] = 0; // NUL-terminate
        },
      };
    },
  });
})();
