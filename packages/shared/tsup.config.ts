import { copyFileSync, mkdirSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
  // Inject `import.meta.url` / `__dirname` shims so path resolution in
  // `safeHarborPromptPath()` works in both the ESM and CJS bundles.
  shims: true,
  // better-sqlite3 is a native module — keep it external, never bundle it.
  external: ["better-sqlite3"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
  // The Safe Harbor prompt is loaded at runtime relative to the bundle, so it
  // must sit next to it in dist/ as well as in src/ (for source consumers).
  async onSuccess() {
    mkdirSync("dist/prompts", { recursive: true });
    copyFileSync("src/phi/prompts/safe_harbor.md", "dist/prompts/safe_harbor.md");
  },
});
