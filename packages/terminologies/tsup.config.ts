import { copyFileSync, mkdirSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
  // Inject `import.meta.url` / `__dirname` shims so the bundled USPSTF snapshot
  // loader works in both ESM and CJS outputs.
  shims: true,
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
  // The USPSTF snapshot is loaded at runtime relative to the bundle, so it must
  // sit next to it in dist/ as well as in data/ (for source / test runs).
  async onSuccess() {
    mkdirSync("dist/data", { recursive: true });
    copyFileSync("data/uspstf-2026-01.json", "dist/data/uspstf-2026-01.json");
  },
});
