import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type Article,
  type ArticleSummary,
  type EvidenceSummary,
  type Recommendation,
  type RecommendationSummary,
  type TreatmentComparison,
  type Trial,
  type TrialSummary,
  evidenceTools,
} from "../src/index.js";
import { buildContext, stubFetchRoutes } from "./helpers.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const tool = (name: string) => {
  const t = evidenceTools().find((d) => d.name === name);
  if (!t) throw new Error(`tool ${name} not found`);
  return t;
};

const esearchBody = (idlist: string[]) => ({
  esearchresult: { count: String(idlist.length), idlist },
});
const esummaryBody = (records: Record<string, unknown>[]) => ({
  result: {
    uids: records.map((r) => r.uid as string),
    ...Object.fromEntries(records.map((r) => [r.uid as string, r])),
  },
});
const ctSearchBody = (trials: { id: string; title: string; status?: string }[]) => ({
  studies: trials.map((t) => ({
    protocolSection: {
      identificationModule: { nctId: t.id, briefTitle: t.title },
      ...(t.status ? { statusModule: { overallStatus: t.status } } : {}),
    },
  })),
});

/* -------------------------------------------------------------------------- */
/* Atomic tools                                                                */
/* -------------------------------------------------------------------------- */

describe("search_pubmed", () => {
  it("composes filters and returns ArticleSummaries", async () => {
    stubFetchRoutes([
      { match: "/esearch.fcgi", body: esearchBody(["111", "222"]) },
      {
        match: "/esummary.fcgi",
        body: esummaryBody([
          { uid: "111", title: "Article A", pubtype: ["Randomized Controlled Trial"] },
          { uid: "222", title: "Article B", pubtype: ["Randomized Controlled Trial"] },
        ]),
      },
    ]);
    const result = await tool("search_pubmed").handler(
      { query: "metformin", publication_types: ["rct"], limit: 5 },
      buildContext(),
    );
    const data = result.data as ArticleSummary[];
    expect(data).toHaveLength(2);
    expect(data[0]?.title).toBe("Article A");
  });

  it("redacts the query in sensitive mode before calling eutils", async () => {
    const fetchFn = stubFetchRoutes([
      { match: "/esearch.fcgi", body: esearchBody([]) },
      { match: "/esummary.fcgi", body: esummaryBody([]) },
    ]);
    const result = await tool("search_pubmed").handler(
      { query: "patient a@b.com metformin", phi_mode: "sensitive" },
      buildContext(),
    );
    expect(result.phi_redaction_applied?.applied).toBe(true);
    const esearchCall = fetchFn.mock.calls.find((c) => String(c[0]).includes("/esearch.fcgi"));
    expect(String(esearchCall?.[0])).not.toContain("a%40b.com");
    expect(String(esearchCall?.[0])).toContain("REDACTED");
  });
});

describe("get_article", () => {
  it("fetches a single article via efetch + MEDLINE parsing", async () => {
    const medline = ["PMID- 333", "TI  - Title here", "AB  - The abstract.", ""].join("\n");
    stubFetchRoutes([{ match: "/efetch.fcgi", text: medline }]);
    const result = await tool("get_article").handler({ pmid: "333" }, buildContext());
    const data = result.data as Article;
    expect(data.pmid).toBe("333");
    expect(data.abstract).toBe("The abstract.");
  });
});

describe("find_related_articles", () => {
  it("walks elink → esummary", async () => {
    stubFetchRoutes([
      {
        match: "/elink.fcgi",
        body: {
          linksets: [
            {
              dbfrom: "pubmed",
              ids: ["111"],
              linksetdbs: [{ linkname: "pubmed_pubmed", links: ["111", "222"] }],
            },
          ],
        },
      },
      { match: "/esummary.fcgi", body: esummaryBody([{ uid: "222", title: "Related" }]) },
    ]);
    const result = await tool("find_related_articles").handler({ pmid: "111" }, buildContext());
    const data = result.data as ArticleSummary[];
    expect(data[0]?.pmid).toBe("222");
  });
});

describe("find_systematic_reviews", () => {
  it("filters the PubMed search to SR / MA publication types", async () => {
    const fetchFn = stubFetchRoutes([
      { match: "/esearch.fcgi", body: esearchBody(["444"]) },
      { match: "/esummary.fcgi", body: esummaryBody([{ uid: "444", title: "SR" }]) },
    ]);
    await tool("find_systematic_reviews").handler({ query: "diabetes" }, buildContext());
    const esearchCall = fetchFn.mock.calls.find((c) => String(c[0]).includes("/esearch.fcgi"));
    expect(String(esearchCall?.[0])).toContain("Systematic+Review");
  });
});

describe("search_trials", () => {
  it("maps a ClinicalTrials.gov response to TrialSummary records", async () => {
    stubFetchRoutes([
      {
        match: "/api/v2/studies?",
        body: ctSearchBody([{ id: "NCT01234567", title: "A trial", status: "RECRUITING" }]),
      },
    ]);
    const result = await tool("search_trials").handler(
      { query: "diabetes", status: ["recruiting"] },
      buildContext(),
    );
    const data = result.data as TrialSummary[];
    expect(data[0]?.nct_id).toBe("NCT01234567");
  });
});

describe("get_trial", () => {
  it("returns the full trial flattened from the protocolSection", async () => {
    stubFetchRoutes([
      {
        match: "/api/v2/studies/NCT01234567",
        body: {
          protocolSection: {
            identificationModule: { nctId: "NCT01234567", briefTitle: "A trial" },
            statusModule: { overallStatus: "RECRUITING" },
            descriptionModule: { briefSummary: "Summary." },
          },
        },
      },
    ]);
    const result = await tool("get_trial").handler({ nct_id: "NCT01234567" }, buildContext());
    const data = result.data as Trial;
    expect(data.brief_summary).toBe("Summary.");
  });

  it("rejects an unknown NCT ID as NOT_FOUND", async () => {
    stubFetchRoutes([{ match: "/api/v2/studies/NCT", body: {}, status: 404 }]);
    await expect(
      tool("get_trial").handler({ nct_id: "NCT99999999" }, buildContext()),
    ).rejects.toMatchObject({ payload: { code: "NOT_FOUND" } });
  });
});

/* -------------------------------------------------------------------------- */
/* Composite tools                                                             */
/* -------------------------------------------------------------------------- */

describe("summarize_evidence", () => {
  it("grades the question as 'high' when systematic reviews exist", async () => {
    stubFetchRoutes([
      // Both esearch calls return ids.
      { match: "/esearch.fcgi", body: esearchBody(["111"]) },
      // Both esummary calls return summaries.
      { match: "/esummary.fcgi", body: esummaryBody([{ uid: "111", title: "An SR" }]) },
      { match: "/api/v2/studies?", body: ctSearchBody([]) },
    ]);
    const result = await tool("summarize_evidence").handler(
      { question: "Does metformin reduce mortality in T2DM?" },
      buildContext(),
    );
    const data = result.data as EvidenceSummary;
    expect(data.evidence_grade).toBe("high");
    expect(data.systematic_reviews.length).toBeGreaterThan(0);
    expect(data.total_evidence_items).toBeGreaterThan(0);
  });

  it("falls back to 'insufficient' when nothing matches", async () => {
    stubFetchRoutes([
      { match: "/esearch.fcgi", body: esearchBody([]) },
      { match: "/esummary.fcgi", body: esummaryBody([]) },
      { match: "/api/v2/studies?", body: ctSearchBody([]) },
    ]);
    const result = await tool("summarize_evidence").handler(
      { question: "Some obscure question" },
      buildContext(),
    );
    const data = result.data as EvidenceSummary;
    expect(data.evidence_grade).toBe("insufficient");
    expect(result.warnings?.join(" ")).toContain("No systematic reviews");
  });
});

describe("compare_treatments", () => {
  it("separates systematic reviews from broader comparative articles", async () => {
    // Both esearch calls return matching id lists.
    stubFetchRoutes([
      { match: "/esearch.fcgi", body: esearchBody(["100", "200"]) },
      {
        match: "/esummary.fcgi",
        body: esummaryBody([
          { uid: "100", title: "An SR comparing A vs B" },
          { uid: "200", title: "A comparative trial" },
        ]),
      },
    ]);
    const result = await tool("compare_treatments").handler(
      { treatment_a: "metformin", treatment_b: "sitagliptin", condition: "T2DM" },
      buildContext(),
    );
    const data = result.data as TreatmentComparison;
    // With our mock both esearches return the same list, so all show up as SRs and
    // the comparative-articles list excludes anything already in the SR set.
    expect(data.systematic_reviews.length + data.comparative_articles.length).toBeGreaterThan(0);
    expect(data.head_to_head_count).toBe(
      data.systematic_reviews.length + data.comparative_articles.length,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* USPSTF tools (evidence-derived preventive-care guidelines, snapshot-served) */
/* -------------------------------------------------------------------------- */

describe("USPSTF tools", () => {
  it("search_uspstf finds recommendations by free-text query", async () => {
    const result = await tool("search_uspstf").handler({ query: "hypertension" }, buildContext());
    const data = result.data as RecommendationSummary[];
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]?.grade).toBe("A");
  });

  it("get_uspstf_recommendation returns the full specific_recommendation text", async () => {
    const result = await tool("get_uspstf_recommendation").handler(
      { id: "aspirin-cvd-prevention-older-adults" },
      buildContext(),
    );
    const data = result.data as Recommendation;
    expect(data.grade).toBe("D");
    expect(data.specific_recommendation).toContain("aspirin");
  });

  it("get_uspstf_recommendation throws NOT_FOUND for unknown IDs", async () => {
    await expect(
      tool("get_uspstf_recommendation").handler({ id: "bogus" }, buildContext()),
    ).rejects.toMatchObject({ payload: { code: "NOT_FOUND" } });
  });

  it("list_uspstf_by_grade filters by letter", async () => {
    const result = await tool("list_uspstf_by_grade").handler({ grade: "A" }, buildContext());
    const data = result.data as RecommendationSummary[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.grade === "A")).toBe(true);
  });

  it("every USPSTF result surfaces the AHRQ license clause as a warning", async () => {
    for (const name of ["search_uspstf", "list_uspstf_by_grade"]) {
      const args = name === "search_uspstf" ? { query: "screening" } : { grade: "A" as const };
      const result = await tool(name).handler(args, buildContext());
      expect(result.warnings?.join(" ")).toContain("AHRQ");
    }
  });
});
