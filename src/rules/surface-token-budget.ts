import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import { TokenCounter } from "../tokens.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

export class SurfaceTokenBudget extends BaseRule {
  readonly id = "surface/token-budget";
  readonly category = "surface" as const;
  readonly severity = "warn" as const;
  readonly weight = 15;
  readonly docsUrl = Docs.anthropicToolGuide;
  readonly rationale =
    "The serialized tools/list payload is injected into every conversation that " +
    "connects the server, before any work happens. Its token cost is a per-message tax.";
  override readonly defaultOptions = { maxTokens: 10_000 };

  override get maxDeduction(): number {
    return this.weight * 2;
  }

  check(snapshot: ServerSnapshot, options: RuleOptions): Finding[] {
    const maxTokens = this.opt<number>(options, "maxTokens");
    const tokens = TokenCounter.snapshot(snapshot);
    if (tokens <= maxTokens) return [];
    return [
      this.finding({
        message: `tools/list footprint is ~${tokens} tokens (${TokenCounter.encoding}, approximate) — above the ${maxTokens}-token budget. Every conversation pays this before the first user message.`
      })
    ];
  }
}
