# arche-editor

The `editor` device: a text-editing surface with two real backends — a native browser `<textarea>` (dom)
and a vendored single-file terminal editor (clib, kilo-style). `make dev` edits in your terminal, `make serve`
in the browser. Depends only on `../arche`.
