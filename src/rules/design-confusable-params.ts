import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class DesignConfusableParams extends BaseRule {
  readonly id = "design/confusable-params";
  readonly category = "design" as const;
  readonly severity = "warn" as const;
  readonly weight = 3;
  readonly docsUrl = Docs.rule("design/confusable-params");
  readonly rationale =
    "The same concept spelled differently across tools (hotel_id vs hotelId vs id) " +
    "makes the model carry a per-tool spelling table and produces cross-tool " +
    "argument bleed. One concept, one name, everywhere.";

  check(snapshot: ServerSnapshot, _options: RuleOptions = {}): Finding[] {
    const spellings = new Map<string, Map<string, string[]>>();
    for (const tool of snapshot.tools) {
      for (const name of Object.keys(BaseRule.properties(tool.inputSchema))) {
        const normalized = BaseRule.normalizeParamName(name);
        const variants = spellings.get(normalized) ?? new Map<string, string[]>();
        variants.set(name, [...(variants.get(name) ?? []), tool.name]);
        spellings.set(normalized, variants);
      }
    }
    const findings: Finding[] = [];
    for (const variants of spellings.values()) {
      if (variants.size < 2) continue;
      const detail = [...variants.entries()]
        .map(([spelling, tools]) => `"${spelling}" (${tools.join(", ")})`)
        .join(" vs ");
      findings.push(
        this.finding({
          message: `Same parameter spelled ${variants.size} ways across tools — pick one spelling.`,
          evidence: detail
        })
      );
    }
    return findings;
  }
}
