import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

type NamingStyle = "snake_case" | "camelCase" | "kebab-case" | "flat";

export class NamingConvention extends BaseRule {
  readonly id = "naming/convention";
  readonly category = "naming" as const;
  readonly severity = "warn" as const;
  readonly weight = 5;
  readonly docsUrl = Docs.anthropicToolGuide;
  readonly rationale =
    "Mixed naming styles read as multiple authors and break the model's ability to " +
    "predict names it has not seen. One convention, applied everywhere.";

  private static styleOf(name: string): NamingStyle {
    if (name.includes("-")) return "kebab-case";
    if (name.includes("_")) return "snake_case";
    if (/[a-z][A-Z]/.test(name)) return "camelCase";
    return "flat";
  }

  check(snapshot: ServerSnapshot, _options: RuleOptions = {}): Finding[] {
    const byStyle = new Map<NamingStyle, string[]>();
    for (const tool of snapshot.tools) {
      const style = NamingConvention.styleOf(tool.name);
      if (style === "flat") continue;
      byStyle.set(style, [...(byStyle.get(style) ?? []), tool.name]);
    }
    if (byStyle.size <= 1) return [];
    const ranked = [...byStyle.entries()].sort((a, b) => b[1].length - a[1].length);
    const [dominant, ...minorities] = ranked;
    return minorities.flatMap(([style, names]) =>
      names.map((name) =>
        this.finding({
          toolName: name,
          message: `Tool "${name}" is ${style} while the dominant convention is ${dominant![0]} (${dominant![1].length} tools).`
        })
      )
    );
  }
}
