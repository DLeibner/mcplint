import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class SchemasComplexityBudget extends BaseRule {
  readonly id = "schemas/complexity-budget";
  readonly category = "schemas" as const;
  readonly severity = "warn" as const;
  readonly weight = 3;
  readonly docsUrl = Docs.rule("schemas/complexity-budget");
  readonly rationale =
    "Deeply nested inputs, very wide property lists, and stacked oneOf/anyOf force " +
    "the model to solve a constraint puzzle before every call. Flatter, narrower " +
    "inputs get filled correctly more often.";
  override readonly defaultOptions = { maxDepth: 3, maxProps: 12, maxCombinators: 2 };

  check(snapshot: ServerSnapshot, options: RuleOptions): Finding[] {
    const maxDepth = this.opt<number>(options, "maxDepth");
    const maxProps = this.opt<number>(options, "maxProps");
    const maxCombinators = this.opt<number>(options, "maxCombinators");
    const findings: Finding[] = [];
    for (const tool of snapshot.tools) {
      let depth = 0;
      let combinators = 0;
      BaseRule.walkSchema(tool.inputSchema, (node) => {
        depth = Math.max(depth, node.depth);
        for (const comb of ["oneOf", "anyOf"]) {
          if (Array.isArray(node.schema[comb])) combinators++;
        }
      });
      const topProps = Object.keys(BaseRule.properties(tool.inputSchema)).length;
      if (depth > maxDepth) {
        findings.push(
          this.finding({
            toolName: tool.name,
            path: "/inputSchema",
            message: `Input schema nests ${depth} levels deep (budget ${maxDepth}).`
          })
        );
      }
      if (topProps > maxProps) {
        findings.push(
          this.finding({
            toolName: tool.name,
            path: "/inputSchema/properties",
            message: `Input schema has ${topProps} top-level properties (budget ${maxProps}).`
          })
        );
      }
      if (combinators > maxCombinators) {
        findings.push(
          this.finding({
            toolName: tool.name,
            path: "/inputSchema",
            message: `Input schema uses oneOf/anyOf ${combinators} times (budget ${maxCombinators}).`
          })
        );
      }
    }
    return findings;
  }
}
