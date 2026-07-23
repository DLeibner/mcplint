import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import { TokenCounter } from "../tokens.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class DesignClientDirectives extends BaseRule {
  readonly id = "design/client-directives";
  readonly category = "design" as const;
  readonly severity = "info" as const;
  readonly weight = 3;
  readonly docsUrl = Docs.rule("design/client-directives");
  readonly rationale =
    "A description should say what the tool does. Imperatives aimed at the client " +
    "('RENDER RESULTS IMMEDIATELY', 'do not call tool X') are prompt injection into " +
    "your own surface: paid for in every conversation, unevenly obeyed, and when " +
    "copy-pasted across tools they drown the words that actually disambiguate. " +
    "Escalates to warn when the same directive block appears in multiple tools.";

  private static readonly RENDERING =
    /\b(?:render|display|show)\b[^.!?\n]*\b(?:immediately|results?|map|widget|markdown|inline|link)/i;
  private static readonly DIRECTIVE_VERB =
    /\b(?:do not|don't|never|always|must(?: not)?)\s+(?:call|invoke|use|run)\b/i;

  private static isDirective(sentence: string, otherToolNames: string[]): boolean {
    if (this.RENDERING.test(sentence)) return true;
    if (this.DIRECTIVE_VERB.test(sentence)) {
      return otherToolNames.some((name) => sentence.includes(name));
    }
    return false;
  }

  check(snapshot: ServerSnapshot, _options: RuleOptions = {}): Finding[] {
    const perTool = new Map<string, string[]>();
    for (const tool of snapshot.tools) {
      const others = snapshot.tools.map((t) => t.name).filter((n) => n !== tool.name);
      const directives = BaseRule.sentences(BaseRule.description(tool)).filter((s) =>
        DesignClientDirectives.isDirective(s, others)
      );
      if (directives.length > 0) perTool.set(tool.name, directives);
    }

    const blockCounts = new Map<string, number>();
    for (const directives of perTool.values()) {
      for (const sentence of directives) {
        const key = BaseRule.words(sentence).join(" ");
        blockCounts.set(key, (blockCounts.get(key) ?? 0) + 1);
      }
    }

    const findings: Finding[] = [];
    for (const [toolName, directives] of perTool) {
      const block = directives.join(" ");
      const tokens = TokenCounter.count(block);
      const duplicated = directives.some(
        (s) => (blockCounts.get(BaseRule.words(s).join(" ")) ?? 0) >= 2
      );
      findings.push(
        this.finding({
          toolName,
          severity: duplicated ? "warn" : "info",
          message:
            `Description contains ${directives.length} client-directive sentence(s) (~${tokens} tokens) about rendering or other tools` +
            (duplicated
              ? ", duplicated across multiple tools — move shared guidance to one server-level place."
              : " — describe what the tool does; put client behaviour elsewhere."),
          evidence: block
        })
      );
    }
    return findings;
  }
}
