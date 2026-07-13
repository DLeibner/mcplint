import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class DescriptionsTooShort extends BaseRule {
  readonly id = "descriptions/too-short";
  readonly category = "descriptions" as const;
  readonly severity = "warn" as const;
  readonly weight = 3;
  readonly docsUrl = Docs.anthropicToolGuide;
  readonly rationale =
    "Descriptions under ~20 characters carry no disambiguation signal. The model needs " +
    "enough context to pick this tool over its neighbours without trial calls.";
  override readonly defaultOptions = { minChars: 20 };

  check(snapshot: ServerSnapshot, options: RuleOptions): Finding[] {
    const minChars = this.opt<number>(options, "minChars");
    return snapshot.tools
      .filter((tool) => {
        const desc = BaseRule.description(tool);
        return desc.length > 0 && desc.length < minChars;
      })
      .map((tool) =>
        this.finding({
          toolName: tool.name,
          message: `Description is ${BaseRule.description(tool).length} chars (minimum ${minChars}) — too short to disambiguate.`,
          evidence: BaseRule.description(tool)
        })
      );
  }
}
