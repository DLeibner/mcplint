import { describe, expect, it } from "vitest";
import { ConfigLoader, configSchema } from "../src/config.js";
import { LintEngine } from "../src/engine.js";
import { RuleRegistry } from "../src/rules/index.js";
import { Fixture } from "./helpers.js";

describe("LintEngine + config", () => {
  it("disables rules set to off", () => {
    const snapshot = Fixture.snapshot([Fixture.tool({ name: "nameless", description: undefined })]);
    const config = configSchema.parse({ rules: { "descriptions/missing": "off" } });
    const report = new LintEngine(RuleRegistry.all(), config).run(snapshot);
    expect(report.findings.filter((f) => f.ruleId === "descriptions/missing")).toHaveLength(0);
  });

  it("applies severity overrides", () => {
    const snapshot = Fixture.snapshot([Fixture.tool({ name: "short", description: "Too short." })]);
    const config = configSchema.parse({ rules: { "descriptions/too-short": "error" } });
    const report = new LintEngine(RuleRegistry.all(), config).run(snapshot);
    const finding = report.findings.find((f) => f.ruleId === "descriptions/too-short");
    expect(finding?.severity).toBe("error");
  });

  it("merges rule options from config", () => {
    const snapshot = Fixture.snapshot([
      Fixture.tool({ name: "medium", description: "A middling description around fifty characters long." })
    ]);
    const config = configSchema.parse({
      rules: { "descriptions/too-short": { options: { minChars: 100 } } }
    });
    const report = new LintEngine(RuleRegistry.all(), config).run(snapshot);
    expect(report.findings.some((f) => f.ruleId === "descriptions/too-short")).toBe(true);
  });

  it("info findings do not deduct from scores", () => {
    const snapshot = Fixture.snapshot([
      Fixture.tool({
        name: "get_detail",
        description: "Get full details for one item. Only call when the user explicitly asks for details."
      })
    ]);
    const report = new LintEngine(RuleRegistry.all(), ConfigLoader.empty()).run(snapshot);
    expect(report.findings.some((f) => f.ruleId === "design/negative-guidance-present")).toBe(true);
    expect(report.scores.categories.design).toBe(100);
  });
});
