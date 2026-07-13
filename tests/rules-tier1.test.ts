import { describe, expect, it } from "vitest";
import { AnnotationsMissingHints } from "../src/rules/annotations-missing-hints.js";
import { DescriptionsMissing } from "../src/rules/descriptions-missing.js";
import { DescriptionsTooLong } from "../src/rules/descriptions-too-long.js";
import { DescriptionsTooShort } from "../src/rules/descriptions-too-short.js";
import { NamingConvention } from "../src/rules/naming-convention.js";
import { SchemasLoose } from "../src/rules/schemas-loose.js";
import { SchemasParamDescMissing } from "../src/rules/schemas-param-desc-missing.js";
import { SurfaceTokenBudget } from "../src/rules/surface-token-budget.js";
import { SurfaceToolBudget } from "../src/rules/surface-tool-budget.js";
import { Fixture } from "./helpers.js";

describe("descriptions/missing", () => {
  it("flags tools without a description", () => {
    const rule = new DescriptionsMissing();
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "no_desc", description: undefined }),
      Fixture.tool({ name: "blank_desc", description: "   " }),
      Fixture.tool({ name: "fine" })
    ]);
    const findings = rule.check(snapshot, {});
    expect(findings.map((f) => f.toolName)).toEqual(["no_desc", "blank_desc"]);
  });
});

describe("descriptions/too-short and too-long", () => {
  it("flags short but not missing descriptions", () => {
    const rule = new DescriptionsTooShort();
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "short", description: "Does stuff." }),
      Fixture.tool({ name: "missing", description: undefined }),
      Fixture.tool({ name: "fine" })
    ]);
    expect(rule.check(snapshot, rule.defaultOptions).map((f) => f.toolName)).toEqual(["short"]);
  });

  it("respects a configured max length", () => {
    const rule = new DescriptionsTooLong();
    const snapshot = Fixture.snapshot([Fixture.tool({ name: "wordy", description: "x".repeat(200) })]);
    expect(rule.check(snapshot, rule.defaultOptions)).toHaveLength(0);
    expect(rule.check(snapshot, { maxChars: 100 })).toHaveLength(1);
  });
});

describe("schemas/param-desc-missing", () => {
  it("flags undescribed properties at any depth", () => {
    const rule = new SchemasParamDescMissing();
    const snapshot = Fixture.snapshot([
      Fixture.tool({
        name: "nested",
        inputSchema: {
          type: "object",
          properties: {
            outer: {
              type: "object",
              description: "Outer object.",
              properties: { inner: { type: "string" } }
            }
          }
        }
      })
    ]);
    const findings = rule.check(snapshot, {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.path).toBe("/inputSchema/properties/outer/properties/inner");
  });
});

describe("surface budgets", () => {
  it("escalates tool count from warn to error", () => {
    const rule = new SurfaceToolBudget();
    const many = (n: number) =>
      Fixture.snapshot(Array.from({ length: n }, (_, i) => Fixture.tool({ name: `tool_${i}` })));
    expect(rule.check(many(20), rule.defaultOptions)).toHaveLength(0);
    expect(rule.check(many(21), rule.defaultOptions)[0]!.severity).toBe("warn");
    expect(rule.check(many(41), rule.defaultOptions)[0]!.severity).toBe("error");
  });

  it("flags token footprint over budget", () => {
    const rule = new SurfaceTokenBudget();
    const snapshot = Fixture.snapshot([Fixture.tool({ name: "chunky", description: "word ".repeat(400) })]);
    expect(rule.check(snapshot, rule.defaultOptions)).toHaveLength(0);
    expect(rule.check(snapshot, { maxTokens: 100 })).toHaveLength(1);
  });
});

describe("naming/convention", () => {
  it("flags the minority style", () => {
    const rule = new NamingConvention();
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "get_thing" }),
      Fixture.tool({ name: "list_things" }),
      Fixture.tool({ name: "fetchAllItems" })
    ]);
    const findings = rule.check(snapshot, {});
    expect(findings.map((f) => f.toolName)).toEqual(["fetchAllItems"]);
  });

  it("is silent when one convention is used", () => {
    const rule = new NamingConvention();
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "get_thing" }),
      Fixture.tool({ name: "list_things" })
    ]);
    expect(rule.check(snapshot, {})).toHaveLength(0);
  });
});

describe("annotations/missing-hints", () => {
  it("flags mutating tools without hints and without titles", () => {
    const rule = new AnnotationsMissingHints();
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "delete_thing" }),
      Fixture.tool({ name: "get_thing" }),
      Fixture.tool({
        name: "create_thing",
        title: "Create thing",
        annotations: { destructiveHint: false }
      })
    ]);
    const findings = rule.check(snapshot, {});
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.toolName === "delete_thing")).toBe(true);
  });
});

describe("schemas/loose", () => {
  it("flags bare objects, untyped arrays, and open additionalProperties", () => {
    const rule = new SchemasLoose();
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "bare", inputSchema: { type: "object" } }),
      Fixture.tool({
        name: "untyped_array",
        inputSchema: {
          type: "object",
          properties: { ids: { type: "array", description: "Ids." } },
          additionalProperties: false
        }
      }),
      Fixture.tool({
        name: "open",
        inputSchema: {
          type: "object",
          properties: { x: { type: "string", description: "X." } },
          additionalProperties: true
        }
      }),
      Fixture.tool({
        name: "empty_but_closed",
        inputSchema: { type: "object", properties: {}, additionalProperties: false }
      })
    ]);
    const findings = rule.check(snapshot, {});
    expect(findings.map((f) => f.toolName).sort()).toEqual(["bare", "open", "untyped_array"]);
  });
});
