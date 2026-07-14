import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class AnnotationsMissingHints extends BaseRule {
  readonly id = "annotations/missing-hints";
  readonly category = "annotations" as const;
  readonly severity = "warn" as const;
  readonly weight = 3;
  readonly docsUrl = Docs.mcpToolsSpec;
  readonly rationale =
    "readOnlyHint/destructiveHint are machine-readable: clients use them to decide " +
    "when to ask the user for confirmation. Prose like 'confirm with the user first' " +
    "is invisible to that machinery.";

  check(snapshot: ServerSnapshot, _options: RuleOptions = {}): Finding[] {
    const findings: Finding[] = [];
    for (const tool of snapshot.tools) {
      const verb = BaseRule.nameTokens(tool.name)[0];
      if (!verb || !BaseRule.MUTATING_VERBS.has(verb)) continue;
      const annotations = tool.annotations ?? {};
      if (annotations.readOnlyHint === undefined && annotations.destructiveHint === undefined) {
        findings.push(
          this.finding({
            toolName: tool.name,
            message: `Mutating tool "${tool.name}" declares neither readOnlyHint nor destructiveHint — clients cannot gate it for confirmation.`
          })
        );
      }
      if (!tool.title && !annotations.title) {
        findings.push(
          this.finding({
            toolName: tool.name,
            severity: "info",
            message: `Mutating tool "${tool.name}" has no title — clients show the raw name in confirmation prompts.`
          })
        );
      }
    }
    return findings;
  }
}
