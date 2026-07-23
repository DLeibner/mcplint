import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class SchemasParamDescMissing extends BaseRule {
  readonly id = "schemas/param-desc-missing";
  readonly category = "schemas" as const;
  readonly severity = "warn" as const;
  readonly weight = 2;
  readonly docsUrl = Docs.anthropicToolGuide;
  readonly rationale =
    "Undescribed parameters get filled by guesswork. Every property the model must " +
    "populate deserves a sentence saying what it means and what shape it takes.";

  check(snapshot: ServerSnapshot, _options: RuleOptions = {}): Finding[] {
    const findings: Finding[] = [];
    for (const tool of snapshot.tools) {
      BaseRule.walkSchema(tool.inputSchema, ({ schema, path }) => {
        for (const [name, prop] of Object.entries(BaseRule.properties(schema))) {
          if (typeof prop !== "object") continue;
          if (!prop.description && !prop.$ref) {
            findings.push(
              this.finding({
                toolName: tool.name,
                path: `/inputSchema${path}/properties/${name}`,
                message: `Parameter "${name}" has no description.`
              })
            );
          }
        }
      });
    }
    return findings;
  }
}
