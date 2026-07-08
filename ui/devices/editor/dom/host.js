// Browser host for the `editor` device's dom backend — SHIPS WITH THE DEVICE; `arche build --arch=wasm32`
// collects it. Fulfils the editor interface with a real <textarea>: the browser gives multi-line editing,
// cursor, selection, undo, and IME for free. `open` focuses it; `text` reads its content back into the world;
// `poll_run` reports a Ctrl-Enter (⌘-Enter) so the composed playground can compile+run on it. `step`/`render`
// are no-ops on the arche side (the textarea manages itself) — they exist only to satisfy the shared interface.
(function () {
  const enc = new TextEncoder();
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
        ta.value = [
          "#import { fmt }",
          "",
          "go :: system eff {",
          "  fmt.printf(\"result = %d\\n\", 6 * 7);",
          "}",
          "",
          "#run seq({ go })",
        ].join("\n");
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

        // editor_be_place(x,y): position the textarea at a projected screen coord (render-px), scaled to CSS-px
        // by innerHeight/renderH (exactly the text-layer scale). First call switches it to a fixed-size panel.
        editor_be_place(x, y) {
          const ta = self.ta, s = window.innerHeight / (rt.renderH || 1080);
          if (ta.style.position !== "absolute") {
            ta.style.position = "absolute";
            ta.style.width = "580px"; ta.style.height = "320px"; ta.style.zIndex = "5";
          }
          ta.style.left = (x * s) + "px";
          ta.style.top = (y * s) + "px";
        },
      };
    },
  });
})();
