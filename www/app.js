// arche-playground app shell. Wires: editor → POST source to the compile service → get { wasm, diagnostics }
// → decode + run via runProgram (compute → text pane, gfx → canvas). Diagnostics render below the editor.
//
// The compile service URL is configurable via ?compile=<url> (defaults to localhost:8791 for dev).
"use strict";

const COMPILE_URL = new URLSearchParams(location.search).get("compile") || "http://127.0.0.1:8791/compile";

const editor = document.getElementById("editor");
const out = document.getElementById("out");
const canvas = document.getElementById("screen");
const runBtn = document.getElementById("run");
const statusEl = document.getElementById("status");
const diagEl = document.getElementById("diagnostics");

let running = null; // the current run handle ({ stop() }), stopped before the next run

const SAMPLE = `// Welcome to the arche playground. Edit and hit Run.
// A compute program prints to the right; a gfx program draws to a canvas.
#import { fmt }

entry :: system eff {
  sum := 0;
  for (i := 1; i <= 10; i += 1) {
    sum = sum + i;
  }
  fmt.printf("sum 1..10 = %d\\n", sum);
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
  setStatus("compiling…");
  renderDiagnostics([]);
  if (running) { running.stop(); running = null; }

  let res;
  try {
    res = await (await fetch(COMPILE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: editor.value }),
    })).json();
  } catch (e) {
    setStatus("compile service unreachable");
    out.textContent = "Could not reach the compile service at " + COMPILE_URL + "\n\n" + e;
    out.style.display = "";
    canvas.style.display = "none";
    runBtn.disabled = false;
    return;
  }

  renderDiagnostics(res.diagnostics);
  if (!res.ok) {
    setStatus("compile failed");
    out.textContent = res.stderr || "compilation failed";
    out.style.display = "";
    canvas.style.display = "none";
    runBtn.disabled = false;
    return;
  }

  setStatus("running…");
  try {
    const bytes = Uint8Array.from(atob(res.wasm), (c) => c.charCodeAt(0));
    running = await runProgram(bytes, { out, canvas });
    setStatus(running.mode === "gfx" ? "running (gfx) — click canvas, ←/→" : "done");
  } catch (e) {
    setStatus("runtime error");
    out.style.display = "";
    canvas.style.display = "none";
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
