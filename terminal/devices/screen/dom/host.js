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
      screen_be_line(row, ptr, n) {
        self.lines[row] = self.dec.decode(new Uint8Array(rt.memory().buffer, ptr, n));
        self.el.textContent = self.lines.join("\n");
      },
      screen_be_present() {}, // native paces; the browser paces via rAF
    };
  },
});
