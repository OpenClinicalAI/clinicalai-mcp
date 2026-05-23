/**
 * Map of server short names to their built CLI paths in this checkout.
 * Resolved at runtime against `import.meta.url` so the harness works regardless
 * of the cwd from which it's invoked.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SERVERS = {
  calc: "../../../packages/calc/dist/cli.js",
  drugs: "../../../packages/drugs/dist/cli.js",
  evidence: "../../../packages/evidence/dist/cli.js",
  terminologies: "../../../packages/terminologies/dist/cli.js",
} as const;

export type ServerName = keyof typeof SERVERS;

export const ALL_SERVERS: ServerName[] = Object.keys(SERVERS) as ServerName[];

/** Absolute path to a server's built `cli.js`, or throw if it isn't built yet. */
export function resolveServerPath(name: ServerName): string {
  const path = fileURLToPath(new URL(SERVERS[name], import.meta.url));
  if (!existsSync(path)) {
    throw new Error(
      `Server "${name}" is not built yet — expected ${path}. Run \`corepack pnpm -r build\` first.`,
    );
  }
  return path;
}
