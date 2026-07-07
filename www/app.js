// arche-playground app shell. FULLY CLIENT-SIDE, no server: the editor's source is compiled by the Arche
// compiler running as WebAssembly (archeCompiler.compile → arche-compile.wasm), then run via runProgram
// (compute → text pane, gfx → canvas). Live diagnostics come from the analyzer wasm. Nothing leaves the browser.
"use strict";

const editor = document.getElementById("editor");
const out = document.getElementById("out");
const canvas = document.getElementById("screen");
const runBtn = document.getElementById("run");
const statusEl = document.getElementById("status");
const diagEl = document.getElementById("diagnostics");

let running = null; // the current run handle ({ stop() }), stopped before the next run

const SAMPLE = `// arche playground — compiles AND runs entirely in your browser (the Arche compiler is WebAssembly).
// No server. Edit and hit Run.
#import { fmt }

N :: 50;

entry :: system eff {
  sum := 0;
  for (i := 1; i <= N; i += 1) {
    sum = sum + i;
  }
  fmt.printf("sum 1..%d = %d\\n", N, sum);
}

#run entry
`;

editor.value = SAMPLE;

function setStatus(msg) { statusEl.textContent = msg; }

function renderDiagnostics(diags) {
  diagEl.innerHTML = "";
  for (const d of diags || []) {
    const div = document.createElement("div");
    div.className = "diag " + (d.severity || "error");
    const loc = d.line != null ? `${d.line}:${d.col ?? 0}` : "";
    div.innerHTML = `<span class="loc">${loc}</span>${d.code ? `[${d.code}] ` : ""}${escapeHtml(d.message)}`;
    diagEl.appendChild(div);
  }
}

function escapeHtml(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

async function run() {
  runBtn.disabled = true;
  setStatus("compiling (in-browser)…");
  if (running) { running.stop(); running = null; }

  // Compile ENTIRELY in the browser — the Arche compiler itself runs as wasm (arche-compile.wasm), no server.
  let res;
  try {
    res = await window.archeCompiler.compile(editor.value);
  } catch (e) {
    setStatus("compiler error");
    out.style.display = "block"; canvas.style.display = "none";
    out.textContent = "compiler error: " + (e && e.message ? e.message : e);
    runBtn.disabled = false;
    return;
  }
  if (!res.ok) {
    setStatus("compile failed");
    out.style.display = "block"; canvas.style.display = "none";
    out.textContent = res.stderr || "compilation failed"; // the live analyzer shows the positioned diagnostic
    runBtn.disabled = false;
    return;
  }

  setStatus("running…");
  try {
    running = await runProgram(res.wasm, { out, canvas });
    setStatus(running.mode === "gfx" ? "running (gfx) — click canvas, ←/→" : "done");
  } catch (e) {
    setStatus("runtime error");
    out.style.display = "block"; canvas.style.display = "none";
    out.textContent = "runtime error: " + (e && e.message ? e.message : e);
  } finally {
    runBtn.disabled = false;
  }
}

runBtn.addEventListener("click", run);
// Cmd/Ctrl+Enter to run.
editor.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); } });

// LIVE diagnostics — the Arche analyzer runs IN THE BROWSER (analyzer/*.wasm), no server. Debounced on every
// edit; populates the same diagnostics pane. This is the client-side path the whole design is built toward.
let analyzeTimer = null;
function scheduleAnalyze() {
  clearTimeout(analyzeTimer);
  analyzeTimer = setTimeout(async () => {
    try {
      const diags = await window.archeAnalyzer.diagnostics(editor.value);
      renderDiagnostics(diags);
      setStatus(diags.some((d) => d.severity === "error") ? "" : "no errors");
    } catch (e) { /* analyzer not ready / crashed — leave the pane */ }
  }, 250);
}
editor.addEventListener("input", scheduleAnalyze);
scheduleAnalyze(); // analyze the initial sample
