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

      // screen_be_place(x,y): position the <pre> at a projected screen coord (render-px), scaled by
      // innerHeight/renderH. First call switches it to a fixed-size panel with its own styling.
      screen_be_place(x, y) {
        const el = self.el, s = window.innerHeight / (rt.renderH || 1080);
        if (el.style.position !== "absolute") {
          el.style.cssText = "position:absolute;width:580px;min-height:130px;margin:0;z-index:5;background:#11151f;" +
            "border:1px solid #1c2130;border-radius:6px;padding:12px;color:#a6e3a1;" +
            "font:13px/1.5 ui-monospace,Menlo,monospace;white-space:pre;overflow:auto;";
        }
        el.style.left = (x * s) + "px";
        el.style.top = (y * s) + "px";
      },
    };
  },
});
