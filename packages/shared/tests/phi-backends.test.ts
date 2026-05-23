import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClinicalMcpError, loadSafeHarborPrompt, redactWithBackend } from "../src/index.js";

const tmpDirs: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

/** A `fetch` stub returning a fixed JSON body. */
function stubFetch(body: unknown, opts: { ok?: boolean; status?: number } = {}) {
  const fn = vi.fn(async (..._args: unknown[]) => ({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** Write a temp ESM module and return its path. */
function tmpModule(source: string): string {
  const dir = mkdtempSync(join(tmpdir(), "clinical-mcp-custom-"));
  tmpDirs.push(dir);
  const path = join(dir, "redactor.mjs");
  writeFileSync(path, source, "utf8");
  return path;
}

describe("presidio backend", () => {
  it("maps Presidio entity types to PHI categories", async () => {
    const fetchFn = stubFetch([{ entity_type: "EMAIL_ADDRESS", start: 5, end: 12 }]);
    const r = await redactWithBackend("Call a@b.com", {
      backend: "presidio",
      presidio: { url: "http://presidio.local" },
    });
    expect(r.backend_used).toBe("presidio");
    expect(r.redacted_text).toBe("Call [REDACTED:EMAIL]");
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain("/analyze");
  });

  it("fails loudly when no presidio.url is configured", async () => {
    await expect(redactWithBackend("x", { backend: "presidio" })).rejects.toBeInstanceOf(
      ClinicalMcpError,
    );
  });

  it("surfaces an unreachable sidecar as UPSTREAM_UNAVAILABLE", async () => {
    stubFetch({}, { ok: false, status: 503 });
    await expect(
      redactWithBackend("x", { backend: "presidio", presidio: { url: "http://x" } }),
    ).rejects.toMatchObject({ payload: { code: "UPSTREAM_UNAVAILABLE" } });
  });
});

describe("openmed backend", () => {
  it("maps NER labels by keyword and accepts a bare array response", async () => {
    stubFetch([{ start: 5, end: 12, label: "EMAIL" }]);
    const r = await redactWithBackend("Call a@b.com", {
      backend: "openmed",
      openmed: { url: "http://openmed.local/infer" },
    });
    expect(r.redacted_text).toBe("Call [REDACTED:EMAIL]");
  });

  it("accepts an { entities: [...] } response shape", async () => {
    stubFetch({ entities: [{ start: 0, end: 4, entity_group: "PATIENT_NAME" }] });
    const r = await redactWithBackend("Jane is here", {
      backend: "openmed",
      openmed: { url: "http://openmed.local/infer" },
    });
    expect(r.redacted_text).toBe("[REDACTED:NAME] is here");
  });
});

describe("ensemble backend", () => {
  it("union redacts anything any backend flagged", async () => {
    // regex finds the email; the (stubbed) presidio sidecar flags "Call" as a name.
    stubFetch([{ entity_type: "PERSON", start: 0, end: 4 }]);
    const r = await redactWithBackend("Call a@b.com", {
      backend: "ensemble",
      ensemble: { backends: ["regex", "presidio"], mode: "union" },
      presidio: { url: "http://x" },
    });
    expect(r.spans).toHaveLength(2);
    expect(r.redacted_text).toBe("[REDACTED:NAME] [REDACTED:EMAIL]");
  });

  it("intersection keeps only spans every backend agreed on", async () => {
    // Both backends flag the same email span → it survives the intersection.
    stubFetch([{ entity_type: "EMAIL_ADDRESS", start: 0, end: 7 }]);
    const r = await redactWithBackend("a@b.com", {
      backend: "ensemble",
      ensemble: { backends: ["regex", "presidio"], mode: "intersection" },
      presidio: { url: "http://x" },
    });
    expect(r.spans).toHaveLength(1);
  });

  it("intersection drops spans only one backend found", async () => {
    // presidio flags "Call" only; regex flags the email only → no agreement.
    stubFetch([{ entity_type: "PERSON", start: 0, end: 4 }]);
    const r = await redactWithBackend("Call a@b.com", {
      backend: "ensemble",
      ensemble: { backends: ["regex", "presidio"], mode: "intersection" },
      presidio: { url: "http://x" },
    });
    expect(r.spans).toHaveLength(0);
  });

  it("rejects an ensemble that includes itself", async () => {
    await expect(
      redactWithBackend("x", {
        backend: "ensemble",
        ensemble: { backends: ["ensemble"], mode: "union" },
      }),
    ).rejects.toBeInstanceOf(ClinicalMcpError);
  });
});

describe("custom backend", () => {
  it("loads a user JS module and applies its spans", async () => {
    const path = tmpModule(
      "export function redact(text, categories) {\n" +
        "  return { spans: [{ start: 0, end: 4, category: 'name' }], warnings: ['custom note'] };\n" +
        "}\n",
    );
    const r = await redactWithBackend("Jane works here", {
      backend: "custom",
      custom: { module_path: path },
    });
    expect(r.backend_used).toBe("custom");
    expect(r.redacted_text).toBe("[REDACTED:NAME] works here");
    expect(r.warnings).toContain("custom note");
  });

  it("fails loudly when the module has no redact export", async () => {
    const path = tmpModule("export const notRedact = 1;\n");
    await expect(
      redactWithBackend("x", { backend: "custom", custom: { module_path: path } }),
    ).rejects.toBeInstanceOf(ClinicalMcpError);
  });

  it("fails loudly when no module_path is configured", async () => {
    await expect(redactWithBackend("x", { backend: "custom" })).rejects.toBeInstanceOf(
      ClinicalMcpError,
    );
  });
});

describe("foundation backend", () => {
  it("fails loudly when no foundation config block is present", async () => {
    await expect(redactWithBackend("x", { backend: "foundation" })).rejects.toBeInstanceOf(
      ClinicalMcpError,
    );
  });

  it("requires an API key for the anthropic provider", async () => {
    await expect(
      redactWithBackend("x", {
        backend: "foundation",
        foundation: {
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          prompt_template: "safe_harbor_verbatim",
        },
      }),
    ).rejects.toMatchObject({ payload: { code: "INVALID_INPUT" } });
  });

  it("requires a base_url for the local provider", async () => {
    await expect(
      redactWithBackend("x", {
        backend: "foundation",
        foundation: {
          provider: "local",
          model: "llama",
          prompt_template: "safe_harbor_verbatim",
        },
      }),
    ).rejects.toMatchObject({ payload: { code: "INVALID_INPUT" } });
  });

  it("ships the verbatim Safe Harbor prompt", () => {
    expect(loadSafeHarborPrompt()).toContain("Safe Harbor");
  });
});
