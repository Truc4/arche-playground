// Browser host for the `button` device's dom backend — SHIPS WITH THE DEVICE; `arche build --arch=wasm32`
// collects it. Fulfils the button interface with a real <button>: `button_be_place` positions/sizes it (render-px
// scaled to CSS by innerHeight/renderH, exactly like the text/editor/screen panels), `button_be_label` sets its
// text, and a click handler raises a flag `button_be_poll` drains (edge-triggered, like gfx's key queue).
(function () {
  (globalThis.archeHosts ??= []).push({
    bind(rt) {
      this.clicked = false;
      let b = document.getElementById("arche-button");
      if (!b) {
        b = document.createElement("button");
        b.id = "arche-button";
        b.type = "button";
        b.style.cssText = "position:absolute;z-index:6;box-sizing:border-box;cursor:pointer;border:none;" +
          "border-radius:6px;background:#e4694e;color:#160d0a;font:600 15px ui-sans-serif,system-ui,sans-serif;";
        (rt.root || document.body).appendChild(b);
      }
      b.addEventListener("click", () => { this.clicked = true; });
      this.b = b;
    },

    seams(rt) {
      const self = this, dec = new TextDecoder();
      return {
        // button_be_place: the composed playground positions the shared frame (via the editor); this just moves
        // the <button> into that frame as an em-sized flex child (once). x/y/w/h are ignored — the frame lays it out.
        button_be_place(x, y, w, h) {
          const f = document.getElementById("arche-playground"), b = self.b;
          if (f && b.parentNode !== f) {
            b.style.cssText = "order:3;flex:0 0 auto;align-self:flex-start;box-sizing:border-box;cursor:pointer;" +
              "border:none;border-radius:0.4em;padding:0.55em 1.5em;background:#e4694e;color:#160d0a;" +
              "font:600 1em ui-sans-serif,system-ui,sans-serif;";
            f.appendChild(b);
          }
        },
        // Set the label (rewrite only on change so a focus ring / press state isn't disturbed each frame).
        button_be_label(ptr, n) {
          const t = dec.decode(new Uint8Array(rt.memory().buffer, ptr, n));
          if (self.b.textContent !== t) self.b.textContent = t;
        },
        // 1 once per click, then clears (drain-and-clear like gfx_be_key / editor_be_poll_run).
        button_be_poll() { const f = self.clicked; self.clicked = false; return f ? 1 : 0; },
      };
    },
  });
})();
