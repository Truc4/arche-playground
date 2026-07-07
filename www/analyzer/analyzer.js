// Client-side Arche analyzer: runs arche-analyzer.wasm (in-browser, via WasiFS) to produce diagnostics with
// ZERO server round-trips. Loads the wasm module + the bundled core/stdlib FS once; each call spins a fresh
// instance (fresh memory), injects the source at /work/prog.arche, runs `--dump`, and parses the DIAG lines.
(function (global) {
  let modulePromise = null, manifestPromise = null;

  function load(base) {
    modulePromise ||= fetch(base + "arche-analyzer.wasm").then((r) => r.arrayBuffer()).then((b) => WebAssembly.compile(b));
    manifestPromise ||= fetch(base + "arche-fs.json").then((r) => r.json());
    return Promise.all([modulePromise, manifestPromise]);
  }

  // Run one analyzer mode over `source`, returning captured stdout. mode: "--dump" | "--tokens".
  async function runMode(source, mode, base) {
    const [module, manifest] = await load(base);
    const wasi = new global.WasiFS(manifest, {
      args: ["arche-analyzer", mode, "/work/prog.arche"],
      env: { ARCHE_CORE_DIR: "/core", ARCHE_STDLIB_DIR: "/stdlib" },
    });
    wasi.writeFile("/work/prog.arche", source);
    wasi.run(module);
    return { stdout: wasi.stdout, stderr: wasi.stderr };
  }

  // Diagnostics: { line, col, severity, code, slug, message }[]. Errors/warnings from `--dump`'s DIAG lines.
  async function diagnostics(source, base = "analyzer/") {
    let out;
    try { out = (await runMode(source, "--dump", base)).stdout; }
    catch (e) { return [{ line: 1, col: 1, severity: "error", code: null, slug: "analyzer", message: "analyzer crashed: " + (e && e.message ? e.message : e) }]; }
    const diags = [];
    for (const line of out.split("\n")) {
      const m = line.match(/^DIAG (\d+) (\d+) (\w+) (\S+) (\S+) (\d+) (.*)$/);
      if (m) diags.push({ line: +m[1], col: +m[2], severity: m[3], code: m[4] === "-" ? null : m[4], slug: m[5], message: m[7] });
    }
    return diags;
  }

  // Highlight tokens: { offset, length, line, col, category }[] from `--tokens`.
  async function tokens(source, base = "analyzer/") {
    let out;
    try { out = (await runMode(source, "--tokens", base)).stdout; } catch { return []; }
    const toks = [];
    for (const line of out.split("\n")) {
      const m = line.match(/^(\d+) (\d+) (\d+) (\d+) (\w+)$/);
      if (m) toks.push({ offset: +m[1], length: +m[2], line: +m[3], col: +m[4], category: m[5] });
    }
    return toks;
  }

  global.archeAnalyzer = { diagnostics, tokens };
})(typeof window !== "undefined" ? window : globalThis);
