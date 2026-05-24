/**
 * `.env` loader — walks upward from cwd to find a project-root `.env`, then
 * hands the file to the standard `dotenv` package for parsing. Real OS env
 * vars take precedence; `.env` values only fill in keys that aren't set.
 *
 * The clinicalai-mcp scaffold calls {@link loadDotEnv} once at server start (top
 * of `runClinicalMcpServer`) so domain servers can rely on `ctx.env.<KEY>`
 * resolving without each user wiring dotenv themselves. We walk upward because
 * domain CLIs run from `packages/<x>/dist/cli.js`, but users expect a single
 * `.env` at the workspace root.
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config as dotenvConfig } from "dotenv";

/**
 * Walk upward from `startDir` looking for a `.env` file, up to `maxDepth`
 * parent directories. Returns the first one found, or `null`.
 */
export function findDotEnv(startDir: string = process.cwd(), maxDepth = 6): string | null {
  let dir = startDir;
  for (let i = 0; i < maxDepth; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

/**
 * Load a `.env` file into `process.env` via the `dotenv` package. `override`
 * stays `false`, so an OS-level key never gets clobbered by a stale repo
 * `.env`. Returns the path that was loaded, or `null` if nothing was found.
 */
export function loadDotEnv(path?: string): string | null {
  const resolvedPath = path ?? findDotEnv();
  if (!resolvedPath) return null;
  const result = dotenvConfig({ path: resolvedPath, override: false });
  if (result.error) return null;
  return resolvedPath;
}
