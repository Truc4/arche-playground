// Browser host for the `editor` device's dom backend — SHIPS WITH THE DEVICE; `arche build --arch=wasm32`
// collects it. Fulfils the editor interface with a real <textarea>: the browser gives multi-line editing,
// cursor, selection, undo, and IME for free. `open` focuses it; `text` reads its content back into the world;
// `poll_run` reports a Ctrl-Enter (⌘-Enter). When a composed playground calls `place`, the editor moves into a
// shared dark FRAME (#arche-playground) as a flex child and the frame is positioned in the world; a standalone
// editor (no `place`) stays a plain full-width textarea.
(function () {
  const enc = new TextEncoder();
  const STARTER = [
    "#import { fmt }", "", "go :: system eff {", "  fmt.printf(\"result = %d\\n\", 6 * 7);", "}", "", "#run seq({ go })",
  ].join("\n");

  // The shared dark playground frame — a flex column the editor/output/button lay out inside (ordered by CSS
  // `order`, so append order doesn't matter). Created lazily on the first `place` call.
  function frame(rt) {
    let f = document.getElementById("arche-playground");
    if (!f) {
      f = document.createElement("div");
      f.id = "arche-playground";
      f.style.cssText = "position:absolute;z-index:5;box-sizing:border-box;display:flex;flex-direction:column;" +
        "gap:0.6em;padding:0.85em;background:#0b0e14;border:1px solid #232838;border-radius:0.6em;" +
        "box-shadow:0 10px 34px rgba(0,0,0,0.5);";
      const title = document.createElement("div");
      title.id = "arche-playground-title";
      title.textContent = "PLAYGROUND";
      title.style.cssText = "order:0;font:700 1.15em/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.08em;" +
        "color:#cdd6f4;padding:0.15em 0.1em 0.55em;border-bottom:1px solid #232838;";
      f.appendChild(title);
      (rt.root || document.body).appendChild(f);
    }
    return f;
  }

  (globalThis.archeHosts ??= []).push({
    bind(rt) {
      this.runPending = false;
      let ta = document.getElementById("arche-editor");
      if (!ta) {
        ta = document.createElement("textarea");
        ta.id = "arche-editor";
        ta.spellcheck = false;
        ta.setAttribute("autocomplete", "off");
        ta.style.cssText = "width:100%;height:58vh;box-sizing:border-box;background:#0b0e14;color:#cdd6f4;" +
          "border:1px solid #1c2130;border-radius:6px;padding:12px;font:14px/1.5 ui-monospace,Menlo,monospace;outline:none;";
        (rt.root || document.body).appendChild(ta);
        ta.value = STARTER;
      }
      // Ctrl-Enter / ⌘-Enter = "run" — raise a flag the driver drains via editor_be_poll_run.
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { this.runPending = true; e.preventDefault(); }
      });
      this.ta = ta;
    },

    seams(rt) {
      const self = this;
      return {
        editor_be_open() { self.ta.focus(); },

        // editor_be_text(bufPtr, cap): write the <textarea> content into the world buffer, NUL-terminated (the
        // driver scans to the terminator — same convention as compiler_be_run; buf is an in-out pointer).
        editor_be_text(bufPtr, cap) {
          const mem = rt.memory();
          const bytes = enc.encode(self.ta.value);
          const k = Math.min(bytes.length, cap - 1);
          new Uint8Array(mem.buffer, bufPtr, cap).set(bytes.subarray(0, k));
          new Uint8Array(mem.buffer)[bufPtr + k] = 0;
        },

        // editor_be_poll_run(): 1 once after Ctrl-Enter, then clears (drain-and-clear like gfx_be_key).
        editor_be_poll_run() { const f = self.runPending; self.runPending = false; return f ? 1 : 0; },

        // editor_be_place(x,y,w): position + WIDTH the shared frame (which the editor owns); the panels lay out
        // inside it. On the first call the editor moves into the frame as a non-resizable flex child. Width + the
        // frame's base font-size scale with innerHeight/renderH, so the whole playground stays a consistent
        // world-space size (everything inside is em-relative) and the frame height is just its content.
        editor_be_place(x, y, w) {
          const s = window.innerHeight / (rt.renderH || 1080), f = frame(rt), ta = self.ta;
          if (ta.parentNode !== f) {
            ta.style.cssText = "order:1;height:22em;width:100%;box-sizing:border-box;resize:none;background:#0e121b;" +
              "color:#cdd6f4;border:1px solid #232838;border-radius:0.4em;padding:0.7em;" +
              "font:1em/1.5 ui-monospace,Menlo,monospace;outline:none;";
            f.appendChild(ta);
          }
          f.style.left = (x * s) + "px";
          f.style.top = (y * s) + "px";
          f.style.width = (w * s) + "px";
          f.style.fontSize = (20 * s) + "px"; // base em unit — everything inside scales with it
        },
      };
    },
  });
})();
