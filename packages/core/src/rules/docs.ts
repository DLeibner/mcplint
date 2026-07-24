export class Docs {
  static readonly anthropicToolGuide =
    "https://www.anthropic.com/engineering/writing-tools-for-agents";
  static readonly mcpToolsSpec =
    "https://modelcontextprotocol.io/specification/2025-06-18/server/tools";

  /**
   * Where per-rule documentation lives. The web app serves the rule catalogue at
   * this path and anchors each section with `slug()`, so CLI reports and web
   * reports link to the same place.
   */
  static readonly base =
    process.env.MCPLINT_DOCS_BASE ??
    "https://github.com/DLeibner/mcp-surface-lint/blob/main/packages/core/docs/rules.md";

  /** `design/crud-mirror` -> `design-crud-mirror` */
  static slug(id: string): string {
    return id.replace(/\//g, "-");
  }

  static rule(id: string): string {
    // The hosted catalogue owns stable rule-specific anchors. The repository
    // fallback is deliberately unanchored because GitHub strips `/` from its
    // generated Markdown heading IDs.
    return process.env.MCPLINT_DOCS_BASE
      ? `${Docs.base}#${Docs.slug(id)}`
      : Docs.base;
  }
}
