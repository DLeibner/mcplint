import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot, ToolDef } from "../types.js";

export class DesignListNoLimit extends BaseRule {
  readonly id = "design/list-no-limit";
  readonly category = "design" as const;
  readonly severity = "warn" as const;
  readonly weight = 3;
  readonly docsUrl = Docs.rule("design/list-no-limit");
  readonly rationale =
    "A list/search tool with no limit or pagination parameter can dump an unbounded " +
    "payload into the context window. The caller must be able to ask for less.";

  private static readonly LIST_VERBS = new Set(["list", "search", "find", "query"]);
  private static readonly LIST_PROSE =
    /\breturns? (?:a |an |the )?(?:list|array|collection) of\b|\bsearch(?:es)? for\b/i;
  private static readonly PAGINATION = new Set([
    "limit", "page", "pagesize", "perpage", "cursor", "offset", "top",
    "maxresults", "first", "size", "count", "pagetoken"
  ]);

  private static impliesList(tool: ToolDef): boolean {
    const verb = BaseRule.nameTokens(tool.name)[0];
    if (verb && this.LIST_VERBS.has(verb)) return true;
    return this.LIST_PROSE.test(BaseRule.description(tool));
  }

  check(snapshot: ServerSnapshot, _options: RuleOptions = {}): Finding[] {
    const findings: Finding[] = [];
    for (const tool of snapshot.tools) {
      if (!DesignListNoLimit.impliesList(tool)) continue;
      const params = Object.keys(BaseRule.properties(tool.inputSchema)).map((p) =>
        BaseRule.normalizeParamName(p)
      );
      if (params.some((p) => DesignListNoLimit.PAGINATION.has(p))) continue;
      findings.push(
        this.finding({
          toolName: tool.name,
          message: `"${tool.name}" implies list/search output but has no limit or pagination parameter — result size is unbounded.`
        })
      );
    }
    return findings;
  }
}
