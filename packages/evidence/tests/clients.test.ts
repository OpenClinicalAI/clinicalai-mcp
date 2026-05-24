import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AHRQ_LICENSE_WARNING,
  articleFromMedline,
  buildPubMedTerm,
  efetchArticle,
  elinkSimilar,
  esearch,
  esummary,
  getRecommendation,
  getTrial,
  listByGrade,
  loadSnapshot,
  parseMedline,
  searchSnapshot,
  searchTrials,
  snapshotProvenanceWarning,
} from "../src/index.js";
import { stubFetchRoutes } from "./helpers.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PubMed eutils client", () => {
  it("esearch returns the idlist", async () => {
    stubFetchRoutes([
      {
        match: "/esearch.fcgi",
        body: { esearchresult: { count: "2", idlist: ["111", "222"] } },
      },
    ]);
    const pmids = await esearch("metformin", { retmax: 10 }, {});
    expect(pmids).toEqual(["111", "222"]);
  });

  it("esummary maps records to ArticleSummary", async () => {
    stubFetchRoutes([
      {
        match: "/esummary.fcgi",
        body: {
          result: {
            uids: ["111"],
            "111": {
              uid: "111",
              title: "Effect of X on Y",
              authors: [{ name: "Smith J", authtype: "Author" }],
              source: "Nature",
              pubdate: "2023 Jan",
              pubtype: ["Randomized Controlled Trial"],
              articleids: [{ idtype: "doi", value: "10.1038/foo" }],
            },
          },
        },
      },
    ]);
    const summaries = await esummary(["111"], {});
    expect(summaries[0]?.title).toBe("Effect of X on Y");
    expect(summaries[0]?.doi).toBe("10.1038/foo");
    expect(summaries[0]?.authors).toEqual(["Smith J"]);
  });

  it("efetchArticle parses MEDLINE output", async () => {
    const medline = [
      "PMID- 12345",
      "TI  - Effect of X on Y",
      "AB  - Background: x. Results: z.",
      "AU  - Smith J",
      "AU  - Doe A",
      "DP  - 2023 Jan",
      "JT  - Nature",
      "AID - 10.1038/foo [doi]",
      "PT  - Randomized Controlled Trial",
      "PT  - Journal Article",
      "MH  - Hypertension",
      "",
    ].join("\n");
    stubFetchRoutes([{ match: "/efetch.fcgi", text: medline }]);
    const article = await efetchArticle("12345", {});
    expect(article?.pmid).toBe("12345");
    expect(article?.title).toContain("Effect of X");
    expect(article?.abstract).toContain("Background");
    expect(article?.authors).toEqual(["Smith J", "Doe A"]);
    expect(article?.doi).toBe("10.1038/foo");
    expect(article?.publication_types).toContain("Randomized Controlled Trial");
    expect(article?.mesh_terms).toEqual(["Hypertension"]);
  });

  it("elinkSimilar returns related PMIDs (excluding the anchor)", async () => {
    stubFetchRoutes([
      {
        match: "/elink.fcgi",
        body: {
          linksets: [
            {
              dbfrom: "pubmed",
              ids: ["111"],
              linksetdbs: [{ linkname: "pubmed_pubmed", links: ["111", "222", "333"] }],
            },
          ],
        },
      },
    ]);
    const related = await elinkSimilar("111", {});
    expect(related).toEqual(["222", "333"]);
  });

  it("buildPubMedTerm composes filters into PubMed syntax", () => {
    const term = buildPubMedTerm("hypertension", {
      publication_types: ["rct", "meta-analysis"],
      date_from: "2020-01-01",
      free_full_text: true,
    });
    expect(term).toContain("hypertension");
    expect(term).toContain("Randomized Controlled Trial");
    expect(term).toContain("Meta-Analysis");
    expect(term).toContain("Date - Publication");
    expect(term).toContain("free full text[sb]");
  });

  it("threads NCBI_API_KEY into the request URL", async () => {
    const fetchFn = stubFetchRoutes([
      {
        match: "/esearch.fcgi",
        body: { esearchresult: { idlist: [] } },
      },
    ]);
    await esearch("anything", { retmax: 1 }, { NCBI_API_KEY: "ncbi-key" });
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain("api_key=ncbi-key");
  });
});

describe("MEDLINE parser", () => {
  it("joins multi-line abstracts on continuation indentation", () => {
    const medline = [
      "PMID- 9",
      "TI  - Short title",
      "AB  - First sentence.",
      "      Continued sentence.",
      "",
    ].join("\n");
    const map = parseMedline(medline);
    expect(map.get("AB")?.[0]).toBe("First sentence. Continued sentence.");
  });

  it("articleFromMedline returns null when no PMID or title is present", () => {
    expect(articleFromMedline(new Map())).toBeNull();
  });
});

describe("ClinicalTrials.gov client", () => {
  it("searchTrials maps the protocolSection into TrialSummary", async () => {
    stubFetchRoutes([
      {
        match: "/api/v2/studies?",
        body: {
          studies: [
            {
              protocolSection: {
                identificationModule: { nctId: "NCT01234567", briefTitle: "A trial" },
                statusModule: { overallStatus: "RECRUITING" },
                conditionsModule: { conditions: ["Hypertension"] },
                designModule: { phases: ["PHASE3"] },
              },
            },
          ],
        },
      },
    ]);
    const trials = await searchTrials({ query: "hypertension", status: ["recruiting"] });
    expect(trials[0]?.nct_id).toBe("NCT01234567");
    expect(trials[0]?.overall_status).toBe("RECRUITING");
  });

  it("getTrial returns null on 404", async () => {
    stubFetchRoutes([{ match: "/api/v2/studies/NCT", body: {}, status: 404 }]);
    expect(await getTrial("NCT99999999")).toBeNull();
  });

  it("getTrial flattens the protocolSection into the full Trial shape", async () => {
    stubFetchRoutes([
      {
        match: "/api/v2/studies/NCT01234567",
        body: {
          protocolSection: {
            identificationModule: { nctId: "NCT01234567", briefTitle: "A trial" },
            statusModule: { overallStatus: "COMPLETED" },
            descriptionModule: { briefSummary: "Summary text." },
            eligibilityModule: { minimumAge: "18 Years", sex: "ALL" },
            armsInterventionsModule: {
              interventions: [{ type: "DRUG", name: "metformin" }],
            },
          },
        },
      },
    ]);
    const trial = await getTrial("NCT01234567");
    expect(trial?.brief_summary).toBe("Summary text.");
    expect(trial?.minimum_age).toBe("18 Years");
    expect(trial?.interventions?.[0]?.name).toBe("metformin");
  });
});

describe("USPSTF snapshot loader", () => {
  it("loads the bundled snapshot with the expected version metadata", () => {
    const snap = loadSnapshot();
    expect(snap.snapshot_version).toBe("2026-01");
    expect(snap.recommendations.length).toBeGreaterThan(0);
  });

  it("searchSnapshot is a case-insensitive substring across title / topic / population / text", () => {
    expect(searchSnapshot("aspirin").length).toBeGreaterThan(0);
    expect(searchSnapshot("HYPERTENSION").length).toBeGreaterThan(0);
  });

  it("listByGrade filters to that letter", () => {
    const a = listByGrade("A");
    expect(a.every((r) => r.grade === "A")).toBe(true);
  });

  it("getRecommendation returns a known ID and undefined for unknown", () => {
    expect(getRecommendation("hypertension-screening-adults")?.grade).toBe("A");
    expect(getRecommendation("bogus-id")).toBeUndefined();
  });

  it("exports the verbatim AHRQ license warning and a snapshot provenance line", () => {
    expect(AHRQ_LICENSE_WARNING).toContain("AHRQ");
    expect(snapshotProvenanceWarning()).toContain("2026-01");
  });
});
