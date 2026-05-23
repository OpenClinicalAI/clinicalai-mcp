/**
 * @clinical-mcp/shared — public API.
 *
 * Shared types, cache, deployment-policy loader, PHI redaction, phi-lint, and
 * the MCP server scaffold consumed by every clinical-mcp domain server.
 */

/* ---- core types -------------------------------------------------------- */
export type {
  CacheHint,
  CacheInfo,
  CrossCuttingInputs,
  DataTier,
  DeploymentType,
  ErrorCode,
  PhiCategory,
  PhiMode,
  PhiRedactionReport,
  RedactionBackend,
  RedactionConfig,
  RedactionSpan,
  SchemaVersion,
  Source,
  ToolError,
  ToolResult,
} from "./types.js";

/* ---- result + error builders ------------------------------------------ */
export {
  ClinicalMcpError,
  type MakeResultInput,
  makeResult,
  nowIso,
  SCHEMA_VERSION,
} from "./results.js";

/* ---- citations --------------------------------------------------------- */
export { formulaSource, makeSource, PUBLISHERS } from "./citations.js";

/* ---- license detection ------------------------------------------------- */
export {
  detectLicenses,
  hasLicense,
  LICENSE_DEFS,
  LICENSE_ENV_VARS,
  type LicenseInfo,
} from "./license.js";

/* ---- cache ------------------------------------------------------------- */
export {
  type Cache,
  cacheKey,
  type CacheEntry,
  type CacheSetOptions,
  createCache,
  type CreateCacheOptions,
  DEFAULT_TTL_S,
  NoopCache,
  normalizeArgs,
  SqliteCache,
} from "./cache/index.js";

/* ---- deployment policy ------------------------------------------------- */
export {
  type LoadedPolicy,
  loadPolicy,
  type PolicyFile,
  policyFileSchema,
  PolicyValidationError,
  PRESET_NAMES,
  PRESETS,
  redactionConfigSchema,
  type ResolvedPolicy,
  resolvePolicy,
} from "./policy/index.js";

/* ---- PHI redaction ----------------------------------------------------- */
export {
  ALL_PHI_CATEGORIES,
  applyRedactionSpans,
  availableRedactionBackends,
  dedupeSpans,
  evaluateRedaction,
  getRedactionBackend,
  loadFoundationPrompt,
  loadSafeHarborPrompt,
  type RedactionBackendImpl,
  type RedactionEvaluation,
  type RedactionResult,
  redactionPlaceholder,
  redactWithBackend,
  regexRedact,
  registerRedactionBackend,
  safeHarborPromptPath,
} from "./phi/index.js";

/* ---- phi-lint ---------------------------------------------------------- */
export {
  classifyPhiField,
  PhiLintError,
  phiLintFieldNames,
  type PhiLintViolation,
  phiLintZodObject,
} from "./phi-lint.js";

/* ---- server scaffold + meta tools ------------------------------------- */
export {
  type ClinicalMcpServer,
  createClinicalMcpServer,
  type CreateServerOptions,
  defineTool,
  runClinicalMcpServer,
  type ServerContext,
  type ToolDef,
} from "./server.js";
export { metaTools } from "./meta-tools.js";

/* ---- tool-handler infrastructure (cross-cutting shape, cache wrapper, ---
 * ---- sensitive-mode redaction) -- shared by every domain package      ---*/
export {
  crossCuttingShape,
  redactIfSensitive,
  type UpstreamText,
  withCache,
  type WithCacheOptions,
} from "./handlers.js";

/* ---- upstream HTTP helpers used by domain client wrappers ------------- */
export { getUpstreamJson, getUpstreamText, type UpstreamRequest } from "./http.js";

/* ---- .env loader (called from runClinicalMcpServer) ------------------- */
export { findDotEnv, loadDotEnv } from "./dotenv.js";
