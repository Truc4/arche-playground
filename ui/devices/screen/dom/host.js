// Browser host for the `screen` device's dom backend. SHIPS WITH THE DEVICE (co-located with backend.arche);
// `arche build --arch=wasm32` collects it into <out>.hosts.js — the browser twin of clib/screen_clib.c.
// Registers the screen_be_* seams on the `archeHosts` global that runtime/arche-web.js assembles + drives.
(globalThis.archeHosts ??= []).push({
  bind(rt) {
    this.el = document.getElementById("arche-screen");
    if (!this.el) {
      this.el = document.createElement("pre");
      this.el.id = "arche-screen";
      (rt.root || document.body).appendChild(this.el);
    }
    this.lines = [];
    this.dec = new TextDecoder();
  },
  seams(rt) {
    const self = this;
    return {
      screen_be_clear() { self.lines = []; self.el.textContent = ""; },
      // screen_be_line(row, sPtr, n): the `(s: []char)` out-param is arche-side only → (row, ptr, n) here.
      // Trim trailing empty rows so the <pre> auto-sizes to its content (a driver may over-allocate rows).
      screen_be_line(row, ptr, n) {
        self.lines[row] = self.dec.decode(new Uint8Array(rt.memory().buffer, ptr, n));
        let last = self.lines.length - 1;
        while (last >= 0 && !self.lines[last]) last--;
        self.el.textContent = self.lines.slice(0, last + 1).join("\n");
      },
      screen_be_present() {}, // native paces; the browser paces via rAF

      // screen_be_place(x,y): the composed playground positions the shared frame (via the editor); this just
      // moves the <pre> into that frame as an em-sized flex child (once). x/y are ignored — the frame lays it out.
      screen_be_place(x, y) {
        const f = document.getElementById("arche-playground"), el = self.el;
        if (f && el.parentNode !== f) {
          el.style.cssText = "order:2;flex:0 0 auto;min-height:5em;max-height:12em;width:100%;box-sizing:border-box;" +
            "margin:0;overflow:auto;background:#11151f;color:#a6e3a1;border:1px solid #232838;border-radius:0.4em;" +
            "padding:0.7em;white-space:pre;font:0.92em/1.5 ui-monospace,Menlo,monospace;";
          f.appendChild(el);
        }
      },
    };
  },
});
