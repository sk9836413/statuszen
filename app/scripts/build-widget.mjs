// Bundles the status widget (src/status-widget) into public/sz.js.
// Runs automatically before `next dev` / `next build` (predev / prebuild) and via `npm run widget:build`.

import { build, transform } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = resolve(root, "src/status-widget/index.ts");
const cssFile = resolve(root, "src/status-widget/widget.css");
const outfile = resolve(root, "public/sz.js");
const MAX_GZIP = 20 * 1024;

try {
  const css = await transform(readFileSync(cssFile, "utf8"), { loader: "css", minify: true, target: ["chrome80", "safari13", "firefox78"] });

  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    minify: true,
    target: "es2017",
    platform: "browser",
    sourcemap: false,
    legalComments: "none",
    charset: "utf8",
    write: false,
    banner: { js: "/*! Statuszen widgets */" },
    define: { __SZ_CSS__: JSON.stringify(css.code.trim()) },
    logLevel: "warning",
  });

  const code = result.outputFiles[0].contents;
  mkdirSync(dirname(outfile), { recursive: true });
  writeFileSync(outfile, code);

  const gz = gzipSync(code, { level: 9 }).length;
  const kb = (n) => (n / 1024).toFixed(2) + " KB";
  console.log(`[widget] public/sz.js  ${kb(code.length)} raw, ${kb(gz)} gzip`);
  if (gz > MAX_GZIP) {
    console.error(`[widget] gzip size ${kb(gz)} exceeds the ${kb(MAX_GZIP)} budget`);
    process.exit(1);
  }
} catch (err) {
  console.error("[widget] build failed:", err && err.message ? err.message : err);
  process.exit(1);
}
