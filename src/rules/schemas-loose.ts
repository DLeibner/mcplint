import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class SchemasLoose extends BaseRule {
  readonly id = "schemas/loose";
  readonly category = "schemas" as const;
  readonly severity = "warn" as const;
  readonly weight = 3;
  readonly docsUrl = Docs.anthropicToolGuide;
  readonly rationale =
    "Loose schemas (bare objects, untyped arrays, open additionalProperties) turn " +
    "schema validation off exactly where the model is most likely to hallucinate " +
    "argument shapes.";

  check(snapshot: ServerSnapshot, _options: RuleOptions = {}): Finding[] {
    const findings: Finding[] = [];
    for (const tool of snapshot.tools) {
      BaseRule.walkSchema(tool.inputSchema, ({ schema, path }) => {
        const at = `/inputSchema${path}`;
        if (
          schema.type === "object" &&
          Object.keys(BaseRule.properties(schema)).length === 0 &&
          typeof schema.additionalProperties !== "object" &&
          schema.additionalProperties !== false
        ) {
          findings.push(
            this.finding({
              toolName: tool.name,
              path: at,
              message: `Bare "type: object" with no properties at ${at || "/inputSchema"} — the model has nothing to go on.`
            })
          );
        }
        if (schema.type === "array" && schema.items === undefined) {
          findings.push(
            this.finding({
              toolName: tool.name,
              path: at,
              message: `Untyped array at ${at} — declare "items".`
            })
          );
        }
        if (schema.additionalProperties === true) {
          findings.push(
            this.finding({
              toolName: tool.name,
              path: at,
              message: `"additionalProperties: true" at ${at} — accepts arbitrary keys silently.`
            })
          );
        }
      });
    }
    return findings;
  }
}
