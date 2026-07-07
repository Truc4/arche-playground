// gen-fs.mjs <arche-src> <out.json> — bundle Arche's core/ + stdlib/ .arche sources into the JSON manifest
// the in-browser WasiFS mounts at /core and /stdlib. Keys are absolute virtual paths, values are file text.
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error("usage: gen-fs.mjs <arche-src> <out.json>"); process.exit(2); }

const files = {};
function walk(dir, mount) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, mount + "/" + name);
    else if (name.endsWith(".arche")) files[mount + "/" + name] = readFileSync(p, "utf8");
  }
}
walk(join(src, "core"), "/core");
walk(join(src, "stdlib"), "/stdlib");
writeFileSync(out, JSON.stringify(files));
console.log(`  bundled ${Object.keys(files).length} files → ${out}`);
