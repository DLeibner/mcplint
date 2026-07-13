import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class DesignEnumCombinationUnencoded extends BaseRule {
  readonly id = "design/enum-combination-unencoded";
  readonly category = "design" as const;
  readonly severity = "info" as const;
  readonly weight = 0;
  readonly docsUrl = Docs.rule("design/enum-combination-unencoded");
  readonly rationale =
    "When the same enum is reused across tools but not every combination is valid " +
    "(e.g. not every product supports every tier), the schema cannot say so — the " +
    "model finds out via runtime errors. Flag shared enums for a validity review.";

  check(snapshot: ServerSnapshot, _options: RuleOptions = {}): Finding[] {
    const bySignature = new Map<string, { values: unknown[]; sites: string[] }>();
    for (const tool of snapshot.tools) {
      BaseRule.walkSchema(tool.inputSchema, ({ schema, path }) => {
        for (const [name, prop] of Object.entries(BaseRule.properties(schema))) {
          if (!Array.isArray(prop.enum) || prop.enum.length < 2) continue;
          const signature = JSON.stringify([...prop.enum].sort());
          const entry =
            bySignature.get(signature) ?? { values: prop.enum, sites: [] as string[] };
          entry.sites.push(`${tool.name}${path}/properties/${name}`);
          bySignature.set(signature, entry);
        }
      });
    }
    const findings: Finding[] = [];
    for (const { values, sites } of bySignature.values()) {
      const tools = new Set(sites.map((site) => site.split("/")[0]));
      if (tools.size < 2) continue;
      findings.push(
        this.finding({
          message: `Enum [${values.join(", ")}] is shared across ${tools.size} tools. If not every combination is valid, the schema cannot express it — encode constraints or document the invalid pairs.`,
          evidence: sites.join("; ")
        })
      );
    }
    return findings;
  }
}
