// Client-side Arche COMPILER: runs the Arche compiler itself (arche-compile.wasm, ~1 MB) in the browser via
// WasiFS, compiling source → a runnable wasm module with ZERO server. The compiler uses its direct wasm
// backend (ARCHE_WASMGEN) — no LLVM/clang. Reuses the same core/stdlib bundle (arche-fs.json) as the analyzer.
//
// compile(source) → { ok, wasm: Uint8Array|null, stderr }. Writes source to /work/in.arche, runs the compiler
// (which writes /work/out.wasm), reads the bytes back.
(function (global) {
  let modulePromise = null, manifestPromise = null;

  function load(base) {
    modulePromise ||= fetch(base + "arche-compile.wasm").then((r) => r.arrayBuffer()).then((b) => WebAssembly.compile(b));
    manifestPromise ||= fetch(base + "arche-fs.json").then((r) => r.json());
    return Promise.all([modulePromise, manifestPromise]);
  }

  async function compile(source, base = "analyzer/") {
    const [module, manifest] = await load(base);
    const wasi = new global.WasiFS(manifest, {
      args: ["arche-compile"],
      env: { ARCHE_WASMGEN: "1", ARCHE_CORE_DIR: "/core", ARCHE_STDLIB_DIR: "/stdlib" },
    });
    wasi.writeFile("/work/in.arche", source);
    let code;
    try { code = wasi.run(module); }
    catch (e) { return { ok: false, wasm: null, stderr: "compiler crashed: " + (e && e.message ? e.message : e) }; }
    const wasm = wasi.readFile("/work/out.wasm");
    return { ok: code === 0 && !!wasm, wasm: wasm || null, stderr: wasi.stderr, exit: code };
  }

  global.archeCompiler = { compile };
})(typeof window !== "undefined" ? window : globalThis);
