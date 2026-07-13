import type { ServerSnapshot, ToolDef } from "../src/types.js";

export class Fixture {
  static snapshot(tools: ToolDef[]): ServerSnapshot {
    return {
      serverInfo: { name: "test-server", version: "0.0.0" },
      tools,
      capturedAt: "2026-07-13T00:00:00.000Z",
      source: "file"
    };
  }

  static tool(overrides: Partial<ToolDef> & { name: string }): ToolDef {
    return {
      description: "A perfectly reasonable tool description for testing purposes.",
      inputSchema: {
        type: "object",
        properties: {
          input: { type: "string", description: "The input value." }
        },
        additionalProperties: false
      },
      ...overrides
    };
  }
}
