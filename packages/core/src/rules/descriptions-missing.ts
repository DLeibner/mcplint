import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class DescriptionsMissing extends BaseRule {
  readonly id = "descriptions/missing";
  readonly category = "descriptions" as const;
  readonly severity = "error" as const;
  readonly weight = 10;
  readonly docsUrl = Docs.anthropicToolGuide;
  readonly rationale =
    "A tool with no description forces the model to guess intent from the name alone. " +
    "The description is the single highest-leverage piece of context for tool selection.";

  check(snapshot: ServerSnapshot, _options: RuleOptions = {}): Finding[] {
    return snapshot.tools
      .filter((tool) => !BaseRule.description(tool))
      .map((tool) =>
        this.finding({
          toolName: tool.name,
          message: `Tool "${tool.name}" has no description.`
        })
      );
  }
}
