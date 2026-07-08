// Browser host for the `editor` device's dom backend — SHIPS WITH THE DEVICE; `arche build --arch=wasm32`
// collects it. Fulfils editor_be_open by dropping a real <textarea> into the page: the browser provides
// multi-line editing, cursor, selection, undo, and IME for free (that's the whole point of the dom backend).
(globalThis.archeHosts ??= []).push({
  seams(rt) {
    return {
      editor_be_open() {
        let ta = document.getElementById("arche-editor");
        if (!ta) {
          ta = document.createElement("textarea");
          ta.id = "arche-editor";
          ta.spellcheck = false;
          ta.setAttribute("autocomplete", "off");
          ta.style.cssText = "width:100%;height:70vh;box-sizing:border-box;background:#0b0e14;color:#cdd6f4;" +
            "border:1px solid #1c2130;border-radius:6px;padding:12px;font:14px/1.5 ui-monospace,Menlo,monospace;outline:none;";
          (rt.root || document.body).appendChild(ta);
        }
        ta.focus();
      },
    };
  },
});
