import { describe, expect, it } from "vitest";
import { ConfigLoader } from "../src/config.js";
import { LintEngine } from "../src/engine.js";
import { SnapshotLoader } from "../src/ingest/index.js";
import { JsonReporter } from "../src/reporters/json.js";
import { RuleRegistry } from "../src/rules/index.js";

describe("golden reports", () => {
  it("bad-server trips every seeded rule", async () => {
    const snapshot = await SnapshotLoader.fromFile("fixtures/bad-server.json");
    const report = new LintEngine(RuleRegistry.all(), ConfigLoader.empty()).run(snapshot);
    const firedRules = new Set(report.findings.map((f) => f.ruleId));
    const expected = [
      "descriptions/missing",
      "descriptions/too-short",
      "descriptions/too-long",
      "schemas/param-desc-missing",
      "surface/tool-budget",
      "naming/convention",
      "annotations/missing-hints",
      "schemas/loose",
      "schemas/complexity-budget",
      "design/overlap-cluster",
      "design/crud-mirror",
      "design/confusable-params",
      "design/enum-in-prose",
      "design/duplicate-leading-words",
      "design/client-directives",
      "design/negative-guidance-present",
      "design/list-no-limit",
      "design/enum-combination-unencoded"
    ];
    for (const ruleId of expected) {
      expect(firedRules, `expected ${ruleId} to fire`).toContain(ruleId);
    }
    expect(report.scores.composite).toBeLessThan(85);
    expect(new JsonReporter().render(report)).toMatchSnapshot();
  });

  it("good-server produces no errors or warnings", async () => {
    const snapshot = await SnapshotLoader.fromFile("fixtures/good-server.json");
    const report = new LintEngine(RuleRegistry.all(), ConfigLoader.empty()).run(snapshot);
    const problems = report.findings.filter((f) => f.severity !== "info");
    expect(problems).toEqual([]);
    expect(report.scores.composite).toBe(100);
    expect(
      report.findings.some((f) => f.ruleId === "design/negative-guidance-present" && f.positive)
    ).toBe(true);
  });

  it("token budget fires via config override on a small fixture", async () => {
    const snapshot = await SnapshotLoader.fromFile("fixtures/bad-server.json");
    const config = ConfigLoader.empty();
    config.rules["surface/token-budget"] = { options: { maxTokens: 500 } };
    const report = new LintEngine(RuleRegistry.all(), config).run(snapshot);
    expect(report.findings.some((f) => f.ruleId === "surface/token-budget")).toBe(true);
  });
});
