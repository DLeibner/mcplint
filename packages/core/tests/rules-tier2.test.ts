import { describe, expect, it } from "vitest";
import { DesignClientDirectives } from "../src/rules/design-client-directives.js";
import { DesignConfusableParams } from "../src/rules/design-confusable-params.js";
import { DesignCrudMirror } from "../src/rules/design-crud-mirror.js";
import { DesignDuplicateLeadingWords } from "../src/rules/design-duplicate-leading-words.js";
import { DesignEnumCombinationUnencoded } from "../src/rules/design-enum-combination-unencoded.js";
import { DesignEnumInProse } from "../src/rules/design-enum-in-prose.js";
import { DesignListNoLimit } from "../src/rules/design-list-no-limit.js";
import { DesignNegativeGuidancePresent } from "../src/rules/design-negative-guidance-present.js";
import { DesignOverlapCluster } from "../src/rules/design-overlap-cluster.js";
import { SchemasComplexityBudget } from "../src/rules/schemas-complexity-budget.js";
import { Fixture } from "./helpers.js";

describe("design/overlap-cluster", () => {
  it("clusters tools sharing a name prefix", () => {
    const rule = new DesignOverlapCluster();
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "get_hotel", description: "Fetch a hotel record for display purposes only." }),
      Fixture.tool({ name: "get_hotel_images", description: "Retrieve gallery pictures belonging to one property listing." }),
      Fixture.tool({ name: "get_hotel_reviews", description: "Load guest feedback entries attached to a given accommodation." }),
      Fixture.tool({ name: "unrelated_tool", description: "Something else entirely, no overlap with the others here." })
    ]);
    const findings = rule.check(snapshot, rule.defaultOptions);
    const prefixFinding = findings.find((f) => f.message.includes("prefix"));
    expect(prefixFinding).toBeDefined();
    expect(prefixFinding!.evidence).toContain("get_hotel_images");
  });

  it("clusters tools with near-duplicate descriptions", () => {
    const rule = new DesignOverlapCluster();
    const shared =
      "Search the catalog of available hotels and return matching results with prices and availability included.";
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "alpha", description: `${shared} Filter by city.` }),
      Fixture.tool({ name: "beta", description: `${shared} Filter by rating.` }),
      Fixture.tool({ name: "gamma", description: "Manage account billing settings and invoices for the organization." })
    ]);
    const findings = rule.check(snapshot, rule.defaultOptions);
    const similarity = findings.find((f) => f.message.includes("overlapping descriptions"));
    expect(similarity).toBeDefined();
    expect(similarity!.evidence).toBe("alpha, beta");
  });
});

describe("design/crud-mirror", () => {
  it("flags a noun covered by three or more CRUD verb classes", () => {
    const rule = new DesignCrudMirror();
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "create_list" }),
      Fixture.tool({ name: "get_list" }),
      Fixture.tool({ name: "delete_list" }),
      Fixture.tool({ name: "list_lists" }),
      Fixture.tool({ name: "get_report" }),
      Fixture.tool({ name: "create_report" })
    ]);
    const findings = rule.check(snapshot, {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('"list"');
  });
});

describe("design/confusable-params", () => {
  it("groups spelling variants of the same concept", () => {
    const rule = new DesignConfusableParams();
    const snapshot = Fixture.snapshot([
      Fixture.tool({
        name: "a",
        inputSchema: { type: "object", properties: { hotel_id: { type: "string", description: "Id." } } }
      }),
      Fixture.tool({
        name: "b",
        inputSchema: { type: "object", properties: { hotelId: { type: "string", description: "Id." } } }
      })
    ]);
    const findings = rule.check(snapshot, {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.evidence).toContain("hotel_id");
    expect(findings[0]!.evidence).toContain("hotelId");
  });
});

describe("design/enum-in-prose", () => {
  it("flags prose-enumerated values without a schema enum", () => {
    const rule = new DesignEnumInProse();
    const snapshot = Fixture.snapshot([
      Fixture.tool({
        name: "prose",
        inputSchema: {
          type: "object",
          properties: {
            sort: { type: "string", description: "One of: price, rating, distance." },
            encoded: { type: "string", enum: ["a", "b"], description: "One of: a, b." }
          }
        }
      })
    ]);
    const findings = rule.check(snapshot, {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.path).toContain("sort");
  });
});

describe("design/duplicate-leading-words", () => {
  it("flags identical description openings", () => {
    const rule = new DesignDuplicateLeadingWords();
    const opening =
      "IMPORTANT always render the interactive map widget immediately after this tool returns its results to the user.";
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "one", description: `${opening} Search by city.` }),
      Fixture.tool({ name: "two", description: `${opening} Search by rating.` }),
      Fixture.tool({ name: "three", description: "A completely different opening that shares nothing with the other two descriptions here." })
    ]);
    const findings = rule.check(snapshot, rule.defaultOptions);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.evidence).toContain("one, two");
  });
});

describe("design/client-directives", () => {
  it("flags rendering directives and escalates duplicated blocks to warn", () => {
    const rule = new DesignClientDirectives();
    const block = "ALWAYS render results immediately as an interactive map widget.";
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "search_a", description: `${block} Search hotels by city and date range for the user.` }),
      Fixture.tool({ name: "search_b", description: `${block} Search hotels near a coordinate pair within a radius.` }),
      Fixture.tool({ name: "quiet", description: "Look up a currency conversion rate between two currency codes." })
    ]);
    const findings = rule.check(snapshot, {});
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.severity === "warn")).toBe(true);
  });

  it("flags directives that name other tools, at info when unique", () => {
    const rule = new DesignClientDirectives();
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "search_x", description: "Search things. Do not call fetch_x after using this tool." }),
      Fixture.tool({ name: "fetch_x", description: "Fetch one thing by its identifier from the store." })
    ]);
    const findings = rule.check(snapshot, {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.toolName).toBe("search_x");
    expect(findings[0]!.severity).toBe("info");
  });

  it("does not flag self-referential negative guidance", () => {
    const rule = new DesignClientDirectives();
    const snapshot = Fixture.snapshot([
      Fixture.tool({
        name: "get_detail",
        description: "Get full details. Do not call speculatively; each call consumes quota."
      })
    ]);
    expect(rule.check(snapshot, {})).toHaveLength(0);
  });
});

describe("design/negative-guidance-present", () => {
  it("credits when-not-to-use guidance as a positive finding", () => {
    const rule = new DesignNegativeGuidancePresent();
    const snapshot = Fixture.snapshot([
      Fixture.tool({
        name: "get_detail",
        description: "Get full details. Only call when the user explicitly asks. Do not call speculatively."
      }),
      Fixture.tool({ name: "plain", description: "Fetch a record from the primary datastore by identifier." })
    ]);
    const findings = rule.check(snapshot, {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.positive).toBe(true);
  });
});

describe("schemas/complexity-budget", () => {
  it("flags deep nesting and wide property lists", () => {
    const rule = new SchemasComplexityBudget();
    const wideProps = Object.fromEntries(
      Array.from({ length: 13 }, (_, i) => [`p${i}`, { type: "string", description: "P." }])
    );
    const snapshot = Fixture.snapshot([
      Fixture.tool({
        name: "deep",
        inputSchema: {
          type: "object",
          properties: {
            a: {
              type: "object",
              properties: {
                b: { type: "object", properties: { c: { type: "object", properties: { d: { type: "string" } } } } }
              }
            }
          }
        }
      }),
      Fixture.tool({ name: "wide", inputSchema: { type: "object", properties: wideProps } })
    ]);
    const findings = rule.check(snapshot, rule.defaultOptions);
    expect(findings.map((f) => f.toolName).sort()).toEqual(["deep", "wide"]);
  });
});

describe("design/list-no-limit", () => {
  it("flags list-shaped tools without pagination", () => {
    const rule = new DesignListNoLimit();
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "list_things" }),
      Fixture.tool({
        name: "search_things",
        inputSchema: {
          type: "object",
          properties: { limit: { type: "integer", description: "Max results." } }
        }
      }),
      Fixture.tool({ name: "get_thing" })
    ]);
    const findings = rule.check(snapshot, {});
    expect(findings.map((f) => f.toolName)).toEqual(["list_things"]);
  });
});

describe("design/enum-combination-unencoded", () => {
  it("flags identical enums shared across tools", () => {
    const rule = new DesignEnumCombinationUnencoded();
    const tier = { type: "string", enum: ["basic", "pro"], description: "Tier." };
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "a", inputSchema: { type: "object", properties: { tier } } }),
      Fixture.tool({ name: "b", inputSchema: { type: "object", properties: { tier } } }),
      Fixture.tool({
        name: "solo",
        inputSchema: {
          type: "object",
          properties: { mode: { type: "string", enum: ["x", "y"], description: "Mode." } }
        }
      })
    ]);
    const findings = rule.check(snapshot, {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("basic");
  });
});
