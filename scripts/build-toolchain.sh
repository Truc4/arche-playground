#!/usr/bin/env sh
# Build the in-browser Arche toolchain the playground loads: the compiler and analyzer cross-compiled to
# wasm32-wasi, plus the core/stdlib source bundle. Rebuilt from the Arche compiler source tree.
#
#   ARCHE_SRC     path to the arche compiler repo   (default: ../arche relative to this repo)
#   WASI_SYSROOT  a WASI sysroot                    (default: /usr/share/wasi-sysroot)
#   CC            C compiler that targets wasm       (default: clang)
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ARCHE_SRC=${ARCHE_SRC:-"$HERE/../arche"}
WASI_SYSROOT=${WASI_SYSROOT:-/usr/share/wasi-sysroot}
CC=${CC:-clang}
OUT="$HERE/www/analyzer"

[ -d "$ARCHE_SRC" ] || { echo "error: ARCHE_SRC not found: $ARCHE_SRC (set ARCHE_SRC=/path/to/arche)"; exit 1; }
[ -d "$WASI_SYSROOT" ] || { echo "error: WASI sysroot not found: $WASI_SYSROOT (set WASI_SYSROOT or install wasi-libc)"; exit 1; }

# NB: the path/version defines must reach C as STRING literals, so the inner quotes are escaped here and
# survive word-splitting of the unquoted $CFLAGS below.
CFLAGS="--target=wasm32-wasi --sysroot=$WASI_SYSROOT -O2 -std=c99 -Wl,-z,stack-size=8388608 -I$ARCHE_SRC \
  -DARCHE_CORE_DIR=\"/core\" -DARCHE_STDLIB_DIR=\"/stdlib\" -DARCHE_RUNTIME_DIR=\"/runtime\" -DARCHE_EXPLAIN_DIR=\"/explain\" -DARCHE_VERSION=\"dev\""

FRONTEND="lexer/lexer.c syntax/type_ref.c syntax/syntax_tree.c syntax/syntax_view.c syntax/token_category.c \
  parser/parser.c hir/hir.c lower/lower.c \
  semantic/semantic.c semantic/sem_model.c semantic/sem_hints.c semantic/sem_diagnostics.c semantic/sem_types.c semantic/tycheck.c \
  compile/module_resolve.c compile/variant_select.c cli/resource.c"

cd "$ARCHE_SRC"

echo "→ compiler wasm  (frontend + codegen + direct wasm backend)"
# shellcheck disable=SC2086
$CC $CFLAGS $FRONTEND syntax/format_syntax.c compile/compile.c \
  codegen/codegen.c codegen/gpu_glsl.c codegen/wasm_encode.c codegen/wasmgen.c codegen/wasm_stubs.c codegen/arche_wasm_main.c \
  -o "$OUT/arche-compile.wasm"

echo "→ analyzer wasm  (frontend + diagnostics, no codegen)"
# shellcheck disable=SC2086
$CC $CFLAGS $FRONTEND arche_analyzer.c arche_analyzer_main.c \
  -o "$OUT/arche-analyzer.wasm"

echo "→ core/stdlib bundle"
node "$HERE/scripts/gen-fs.mjs" "$ARCHE_SRC" "$OUT/arche-fs.json"

echo "toolchain built → $OUT"
