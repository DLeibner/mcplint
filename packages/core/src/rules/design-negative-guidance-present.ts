import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class DesignNegativeGuidancePresent extends BaseRule {
  readonly id = "design/negative-guidance-present";
  readonly category = "design" as const;
  readonly severity = "info" as const;
  readonly weight = 0;
  readonly docsUrl = Docs.rule("design/negative-guidance-present");
  readonly rationale =
    "Positive check. 'When NOT to use this tool' guidance is one of the highest-value " +
    "lines a description can carry — it prevents speculative calls that waste quota " +
    "and context. Credit it; keep it during any consolidation.";

  private static readonly NEGATIVE_GUIDANCE =
    /\b(?:only (?:call|use) (?:this|when|if)|when not to use|(?:do not|don't|never) (?:call|use) (?:this|it) (?:speculatively|unless|when|if|for)|(?:do not|don't) call speculatively|avoid (?:calling|using) (?:this|it))\b/i;

  check(snapshot: ServerSnapshot, _options: RuleOptions = {}): Finding[] {
    return snapshot.tools
      .filter((tool) => DesignNegativeGuidancePresent.NEGATIVE_GUIDANCE.test(BaseRule.description(tool)))
      .map((tool) =>
        this.finding({
          toolName: tool.name,
          positive: true,
          message: `Good pattern: "${tool.name}" documents when NOT to use it. Preserve this in any consolidation.`,
          evidence: BaseRule.sentences(BaseRule.description(tool)).find((s) =>
            DesignNegativeGuidancePresent.NEGATIVE_GUIDANCE.test(s)
          )
        })
      );
  }
}
