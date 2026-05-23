import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAdverseEventCounts,
  fetchEnforcement,
  fetchLabelByRxcui,
  fetchSplsByRxcui,
  getRelatedConcepts,
  getRxNormProperties,
  searchDrugs,
} from "../src/index.js";
import { stubFetchRoutes } from "./helpers.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("openFDA client", () => {
  it("fetches a label by RxCUI", async () => {
    stubFetchRoutes([
      {
        match: "/drug/label.json",
        body: {
          results: [
            {
              set_id: "abc-123",
              indications_and_usage: ["Indicated for ..."],
              openfda: { brand_name: ["Glucophage"], rxcui: ["6809"] },
            },
          ],
        },
      },
    ]);
    const label = await fetchLabelByRxcui("6809", {});
    expect(label?.set_id).toBe("abc-123");
    expect(label?.openfda?.brand_name?.[0]).toBe("Glucophage");
  });

  it("returns null when openFDA has no matching label", async () => {
    stubFetchRoutes([{ match: "/drug/label.json", body: {}, status: 404 }]);
    expect(await fetchLabelByRxcui("9999999", {})).toBeNull();
  });

  it("aggregates FAERS reaction counts", async () => {
    stubFetchRoutes([
      {
        match: "/drug/event.json",
        body: {
          results: [
            { term: "NAUSEA", count: 1200 },
            { term: "HEADACHE", count: 800 },
          ],
          meta: { results: { total: 50000 } },
        },
      },
    ]);
    const ae = await fetchAdverseEventCounts("6809", { limit: 25 }, {});
    expect(ae.total).toBe(50000);
    expect(ae.top[0]?.term).toBe("NAUSEA");
  });

  it("returns enforcement (recall) records", async () => {
    stubFetchRoutes([
      {
        match: "/drug/enforcement.json",
        body: {
          results: [
            {
              recall_number: "D-001-2024",
              classification: "Class II",
              status: "Ongoing",
              reason_for_recall: "Failed dissolution",
            },
          ],
        },
      },
    ]);
    const recalls = await fetchEnforcement("6809", {});
    expect(recalls).toHaveLength(1);
    expect(recalls[0]?.classification).toBe("Class II");
  });

  it("threads the openFDA API key into the request URL when configured", async () => {
    const fetchFn = stubFetchRoutes([{ match: "/drug/label.json", body: { results: [] } }]);
    await fetchLabelByRxcui("6809", { OPENFDA_API_KEY: "test-key" });
    const called = String(fetchFn.mock.calls[0]?.[0]);
    expect(called).toContain("api_key=test-key");
  });
});

describe("RxNorm client", () => {
  it("searches drug concepts by name", async () => {
    stubFetchRoutes([
      {
        match: "/REST/drugs.json",
        body: {
          drugGroup: {
            name: "metformin",
            conceptGroup: [
              {
                tty: "IN",
                conceptProperties: [{ rxcui: "6809", name: "metformin", tty: "IN" }],
              },
              {
                tty: "BN",
                conceptProperties: [{ rxcui: "316256", name: "Glucophage", tty: "BN" }],
              },
            ],
          },
        },
      },
    ]);
    const results = await searchDrugs("metformin");
    expect(results.map((r) => r.rxcui)).toEqual(["6809", "316256"]);
  });

  it("returns RxNorm properties for a known RxCUI", async () => {
    stubFetchRoutes([
      {
        match: "/REST/rxcui/6809/properties.json",
        body: { properties: { rxcui: "6809", name: "metformin", tty: "IN" } },
      },
    ]);
    const props = await getRxNormProperties("6809");
    expect(props?.name).toBe("metformin");
  });

  it("groups related concepts by term type", async () => {
    stubFetchRoutes([
      {
        match: "/related.json",
        body: {
          relatedGroup: {
            rxcui: "6809",
            conceptGroup: [
              { tty: "BN", conceptProperties: [{ rxcui: "316256", name: "Glucophage" }] },
              { tty: "SCD", conceptProperties: [{ rxcui: "861007", name: "metformin 500 MG" }] },
            ],
          },
        },
      },
    ]);
    const related = await getRelatedConcepts("6809", ["BN", "SCD"]);
    expect(related.get("BN")?.[0]?.name).toBe("Glucophage");
    expect(related.get("SCD")?.[0]?.rxcui).toBe("861007");
  });
});

describe("DailyMed client", () => {
  it("lists SPLs for an RxCUI", async () => {
    stubFetchRoutes([
      {
        match: "/services/v2/spls.json",
        body: { data: [{ setid: "uuid-1", title: "GLUCOPHAGE", spl_version: 5 }] },
      },
    ]);
    const spls = await fetchSplsByRxcui("6809");
    expect(spls[0]?.setid).toBe("uuid-1");
  });
});
