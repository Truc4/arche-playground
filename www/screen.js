// DOM host for the `screen` device's dom backend (browser). It fulfils the screen_be_* wasm imports by
// writing the world's text lines into a <pre> — the exact browser twin of the native clib backend
// (devices/screen/clib/screen_clib.c), which writes the same seams to a tty. Same program, two backends:
// `make dev` renders in your terminal, `make serve` renders here. Mirrors www/text.js.
(function (global) {
  class ScreenLayer {
    constructor(el) {
      this.el = el;
      this.lines = [];
      this.memory = null; // set to instance.exports.memory after instantiation
      this._dec = new TextDecoder();
    }
    get imports() {
      const self = this;
      return {
        screen_be_clear() { self.lines = []; self.el.textContent = ""; },
        // screen_be_line(row, sPtr, n): the `(s: []char)` out-param is arche-side only, so C/wasm see (row,ptr,n).
        screen_be_line(row, ptr, n) {
          self.lines[row] = self._dec.decode(new Uint8Array(self.memory.buffer, ptr, n));
          self.el.textContent = self.lines.join("\n");
        },
        log_be_emit() {}, // panic/log seam — unused by the demo
      };
    }
  }
  global.ScreenLayer = ScreenLayer;
})(window);
