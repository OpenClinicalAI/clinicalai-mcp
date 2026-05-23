/**
 * The `foundation` backend — the recommended choice for `covered_entity`
 * deployments (ARCHITECTURE.md §3.5.4). It sends each free-text input to a
 * configured foundation model with the verbatim HIPAA Safe Harbor identifier
 * list in the system prompt: materially better recall on the long tail (typo'd
 * names, embedded dates, geographic identifiers smaller than state), at the
 * cost of latency and per-call inference.
 *
 * Providers:
 *   - `anthropic` — the official `@anthropic-ai/sdk`. The (large, static) Safe
 *     Harbor system prompt is marked `cache_control: ephemeral` so it is reused
 *     across the many redaction calls a `sensitive`-mode deployment makes.
 *   - `openai`    — OpenAI-compatible `/chat/completions` over fetch.
 *   - `local`     — an Ollama-compatible OpenAI endpoint via `base_url`.
 *
 * The model returns a spans list; the redacted text is **reconstructed locally**
 * from those spans so the output is deterministic and never depends on the
 * model copying text back correctly.
 */

import { ClinicalMcpError } from "../../results.js";
import type { PhiCategory, RedactionConfig, RedactionSpan } from "../../types.js";
import { ALL_PHI_CATEGORIES } from "../patterns.js";
import { loadFoundationPrompt } from "../prompt-loader.js";
import { applyRedactionSpans, dedupeSpans } from "../redact.js";
import type { RedactionBackendImpl } from "./registry.js";

type FoundationConfig = NonNullable<RedactionConfig["foundation"]>;

/** Generous output ceiling: redacted text + spans JSON can run a bit over input size. */
function maxOutputTokens(text: string): number {
  return Math.min(32000, Math.max(4096, Math.ceil(text.length * 0.9) + 2048));
}

/** Pull the first balanced-looking JSON object out of a model response. */
function extractJsonObject(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw ClinicalMcpError.of(
      "INTERNAL",
      "foundation backend: model response contained no JSON object.",
    );
  }
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (err) {
    throw ClinicalMcpError.of(
      "INTERNAL",
      `foundation backend: model response was not valid JSON: ${(err as Error).message}`,
    );
  }
}

/** Validate and clamp the model's spans against the original text and requested categories. */
function parseFoundationSpans(
  raw: string,
  text: string,
  categories: PhiCategory[],
): RedactionSpan[] {
  const parsed = extractJsonObject(raw) as { spans?: unknown };
  const wanted = new Set(categories);
  const validCategory = new Set<string>(ALL_PHI_CATEGORIES);
  const out: RedactionSpan[] = [];

  if (!Array.isArray(parsed.spans)) return out;
  for (const entry of parsed.spans) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const start = typeof e.start === "number" ? e.start : Number.NaN;
    const end = typeof e.end === "number" ? e.end : Number.NaN;
    const category = e.category;
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    if (typeof category !== "string" || !validCategory.has(category)) continue;
    if (!wanted.has(category as PhiCategory)) continue;
    // Clamp to the bounds of the actual text — model offsets can drift.
    const s = Math.max(0, Math.min(start, text.length));
    const en = Math.max(0, Math.min(end, text.length));
    if (en <= s) continue;
    out.push({ start: s, end: en, category: category as PhiCategory, text: text.slice(s, en) });
  }
  return out;
}

function resolveApiKey(fc: FoundationConfig): string | undefined {
  return fc.api_key_env ? process.env[fc.api_key_env] : undefined;
}

/** Call Claude via the official Anthropic SDK, with the Safe Harbor prompt cached. */
async function callAnthropic(
  systemPrompt: string,
  text: string,
  fc: FoundationConfig,
): Promise<string> {
  const apiKey = resolveApiKey(fc);
  if (!apiKey) {
    throw ClinicalMcpError.of(
      "INVALID_INPUT",
      "foundation provider 'anthropic' requires foundation.api_key_env to resolve to an API key.",
    );
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, ...(fc.base_url ? { baseURL: fc.base_url } : {}) });

  const stream = client.messages.stream({
    model: fc.model,
    max_tokens: maxOutputTokens(text),
    // The verbatim Safe Harbor prompt is the stable prefix — cache it so the
    // many calls a sensitive-mode deployment makes reuse it.
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: text }],
  });
  const message = await stream.finalMessage();
  return message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
}

/** Call an OpenAI-compatible `/chat/completions` endpoint (the `openai` and `local` providers). */
async function callOpenAiCompatible(
  systemPrompt: string,
  text: string,
  fc: FoundationConfig,
  defaultBaseUrl: string | undefined,
): Promise<string> {
  const baseUrl = fc.base_url ?? defaultBaseUrl;
  if (!baseUrl) {
    throw ClinicalMcpError.of(
      "INVALID_INPUT",
      `foundation provider '${fc.provider}' requires foundation.base_url to be set.`,
    );
  }
  const headers: Record<string, string> = { "content-type": "application/json" };
  const apiKey = resolveApiKey(fc);
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  let resp: Response;
  try {
    resp = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: fc.model,
        max_tokens: maxOutputTokens(text),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
      }),
    });
  } catch (err) {
    throw ClinicalMcpError.of(
      "UPSTREAM_UNAVAILABLE",
      `foundation provider '${fc.provider}' was unreachable: ${(err as Error).message}`,
      { upstream: { service: fc.provider } },
    );
  }
  if (!resp.ok) {
    throw ClinicalMcpError.of(
      "UPSTREAM_UNAVAILABLE",
      `foundation provider '${fc.provider}' returned HTTP ${resp.status}.`,
      { upstream: { service: fc.provider, status: resp.status } },
    );
  }
  const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

export const foundationBackend: RedactionBackendImpl = {
  name: "foundation",
  async redact(text, categories, config) {
    const fc = config.foundation;
    if (!fc) {
      throw ClinicalMcpError.of(
        "INVALID_INPUT",
        "phi_redaction.backend is 'foundation' but no `foundation` config block is present.",
      );
    }
    const systemPrompt = loadFoundationPrompt(config);

    let raw: string;
    if (fc.provider === "anthropic") {
      raw = await callAnthropic(systemPrompt, text, fc);
    } else if (fc.provider === "openai") {
      raw = await callOpenAiCompatible(systemPrompt, text, fc, "https://api.openai.com/v1");
    } else {
      raw = await callOpenAiCompatible(systemPrompt, text, fc, undefined);
    }

    const spans = dedupeSpans(parseFoundationSpans(raw, text, categories));
    return {
      redacted_text: applyRedactionSpans(text, spans),
      spans,
      backend_used: "foundation",
      warnings: [],
    };
  },
};
