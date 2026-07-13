export class Docs {
  static readonly anthropicToolGuide =
    "https://www.anthropic.com/engineering/writing-tools-for-agents";
  static readonly mcpToolsSpec =
    "https://modelcontextprotocol.io/specification/2025-06-18/server/tools";

  static rule(id: string): string {
    return `https://github.com/mcplint/mcplint/blob/main/docs/rules.md#${id.replace("/", "")}`;
  }
}
