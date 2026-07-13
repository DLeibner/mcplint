import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class DesignEnumInProse extends BaseRule {
  readonly id = "design/enum-in-prose";
  readonly category = "design" as const;
  readonly severity = "warn" as const;
  readonly weight = 3;
  readonly docsUrl = Docs.rule("design/enum-in-prose");
  readonly rationale =
    "Values enumerated in prose ('one of: a, b, c') are invisible to schema " +
    "validation: the model can misspell them and the server only finds out at " +
    "call time. If the value set is closed, encode it as an enum.";

  private static readonly PROSE_ENUM =
    /\b(?:one of|allowed values|possible values|valid values|valid options|must be either|can be one of)\b/i;

  check(snapshot: ServerSnapshot, _options: RuleOptions = {}): Finding[] {
    const findings: Finding[] = [];
    for (const tool of snapshot.tools) {
      BaseRule.walkSchema(tool.inputSchema, ({ schema, path }) => {
        for (const [name, prop] of Object.entries(BaseRule.properties(schema))) {
          const desc = typeof prop.description === "string" ? prop.description : "";
          if (!DesignEnumInProse.PROSE_ENUM.test(desc)) continue;
          if (prop.enum !== undefined || prop.type === "boolean") continue;
          findings.push(
            this.finding({
              toolName: tool.name,
              path: `/inputSchema${path}/properties/${name}`,
              message: `Parameter "${name}" enumerates its values in prose but declares no enum.`,
              evidence: desc
            })
          );
        }
      });
    }
    return findings;
  }
}
