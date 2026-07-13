import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class DescriptionsTooLong extends BaseRule {
  readonly id = "descriptions/too-long";
  readonly category = "descriptions" as const;
  readonly severity = "warn" as const;
  readonly weight = 3;
  readonly docsUrl = Docs.anthropicToolGuide;
  readonly rationale =
    "Very long tool descriptions are paid for in every conversation. Detail that only " +
    "matters once a parameter is used belongs in that parameter's description.";
  override readonly defaultOptions = { maxChars: 1500 };

  check(snapshot: ServerSnapshot, options: RuleOptions): Finding[] {
    const maxChars = this.opt<number>(options, "maxChars");
    return snapshot.tools
      .filter((tool) => BaseRule.description(tool).length > maxChars)
      .map((tool) =>
        this.finding({
          toolName: tool.name,
          message: `Description is ${BaseRule.description(tool).length} chars (maximum ${maxChars}) — move detail into parameter descriptions.`
        })
      );
  }
}
