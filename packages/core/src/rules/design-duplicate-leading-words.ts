import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import { TokenCounter } from "../tokens.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class DesignDuplicateLeadingWords extends BaseRule {
  readonly id = "design/duplicate-leading-words";
  readonly category = "design" as const;
  readonly severity = "warn" as const;
  readonly weight = 4;
  readonly docsUrl = Docs.rule("design/duplicate-leading-words");
  readonly rationale =
    "Models disambiguate tools primarily by their leading tokens. When several " +
    "descriptions open with the same words, the distinguishing signal is buried — " +
    "and identical openings usually mean a copy-pasted block that belongs in one place.";
  override readonly defaultOptions = { leadingWords: 15, minTools: 2 };

  check(snapshot: ServerSnapshot, options: RuleOptions): Finding[] {
    const leadingWords = this.opt<number>(options, "leadingWords");
    const minTools = this.opt<number>(options, "minTools");
    const byOpening = new Map<string, string[]>();
    for (const tool of snapshot.tools) {
      const words = BaseRule.words(BaseRule.description(tool));
      if (words.length < leadingWords) continue;
      const key = words.slice(0, leadingWords).join(" ");
      byOpening.set(key, [...(byOpening.get(key) ?? []), tool.name]);
    }
    const findings: Finding[] = [];
    for (const [opening, tools] of byOpening) {
      if (tools.length < minTools) continue;
      const cost = TokenCounter.count(opening) * tools.length;
      findings.push(
        this.finding({
          message: `${tools.length} tools open with the same ${leadingWords} words (~${cost} tokens duplicated across the surface) — move the shared block to one place and lead with what each tool does.`,
          evidence: `${tools.join(", ")} — "${opening}…"`
        })
      );
    }
    return findings;
  }
}
