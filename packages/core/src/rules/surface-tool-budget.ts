import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class SurfaceToolBudget extends BaseRule {
  readonly id = "surface/tool-budget";
  readonly category = "surface" as const;
  readonly severity = "warn" as const;
  readonly weight = 15;
  readonly docsUrl = Docs.anthropicToolGuide;
  readonly rationale =
    "Tool selection accuracy degrades as the surface grows: more near-neighbours to " +
    "confuse, more tokens spent before the first user message. Fewer, intent-shaped " +
    "tools outperform one-tool-per-endpoint surfaces.";
  override readonly defaultOptions = { warnAt: 20, errorAt: 40 };

  override get maxDeduction(): number {
    return this.weight * 2;
  }

  check(snapshot: ServerSnapshot, options: RuleOptions): Finding[] {
    const warnAt = this.opt<number>(options, "warnAt");
    const errorAt = this.opt<number>(options, "errorAt");
    const count = snapshot.tools.length;
    if (count <= warnAt) return [];
    const overError = count > errorAt;
    return [
      this.finding({
        severity: overError ? "error" : "warn",
        message: `Server exposes ${count} tools (${overError ? `error threshold ${errorAt}` : `warn threshold ${warnAt}`} exceeded). Consider consolidating into fewer intent-shaped tools.`
      })
    ];
  }
}
