/**
 * Thin upstream-HTTP helper used by domain packages (`drugs`, `evidence`, …).
 * Maps HTTP failures onto the structured {@link ClinicalMcpError} codes (§3.3)
 * so every tool surfaces failure in a uniform shape.
 *
 * Lives in `shared` because the same wrapper is consumed by multiple domain
 * packages and is otherwise pure infrastructure.
 */

import { ClinicalMcpError } from "./results.js";

const USER_AGENT = "clinical-mcp/0.1 (+https://github.com/kswanjitsu/OpenClinicalAI)";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface UpstreamRequest {
  /** Service name for error envelopes, e.g. "openfda", "pubmed", "clinicaltrials". */
  service: string;
  url: string;
  /** Wall-clock timeout for the request. Defaults to 15 seconds. */
  timeoutMs?: number;
}

/** Translate HTTP-status failures into structured `ClinicalMcpError` codes. */
function mapHttpError(service: string, url: string, resp: Response): ClinicalMcpError {
  if (resp.status === 404) {
    return ClinicalMcpError.of("NOT_FOUND", `${service} returned 404 for ${url}.`, {
      upstream: { service, status: 404 },
    });
  }
  if (resp.status === 429) {
    const retryAfter = resp.headers.get("retry-after");
    return ClinicalMcpError.of("RATE_LIMITED", `${service} rate-limited the request.`, {
      upstream: { service, status: 429 },
      ...(retryAfter ? { suggestion: `Retry after ${retryAfter} seconds.` } : {}),
    });
  }
  return ClinicalMcpError.of("UPSTREAM_UNAVAILABLE", `${service} returned HTTP ${resp.status}.`, {
    upstream: { service, status: resp.status },
  });
}

/** GET with a timeout and consistent error mapping; returns the raw `Response`. */
async function getUpstream(req: UpstreamRequest): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const resp = await fetch(req.url, {
      method: "GET",
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!resp.ok) throw mapHttpError(req.service, req.url, resp);
    return resp;
  } catch (err) {
    if (err instanceof ClinicalMcpError) throw err;
    throw ClinicalMcpError.of(
      "UPSTREAM_UNAVAILABLE",
      `${req.service} was unreachable: ${(err as Error).message}`,
      { upstream: { service: req.service } },
    );
  } finally {
    clearTimeout(timer);
  }
}

/** GET a JSON document. */
export async function getUpstreamJson<T>(req: UpstreamRequest): Promise<T> {
  const resp = await getUpstream(req);
  try {
    return (await resp.json()) as T;
  } catch (err) {
    throw ClinicalMcpError.of(
      "UPSTREAM_UNAVAILABLE",
      `${req.service} returned a non-JSON response: ${(err as Error).message}`,
      { upstream: { service: req.service, status: resp.status } },
    );
  }
}

/** GET a text document (used for endpoints that don't speak JSON, e.g. NCBI MEDLINE). */
export async function getUpstreamText(req: UpstreamRequest): Promise<string> {
  const resp = await getUpstream(req);
  return resp.text();
}
