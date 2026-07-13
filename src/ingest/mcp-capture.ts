import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ServerSnapshot, ToolDef } from "../types.js";

export class McpCapture {
  static async fromStdio(command: string): Promise<ServerSnapshot> {
    const [cmd, ...args] = this.splitCommand(command);
    if (!cmd) throw new Error("Empty stdio command.");
    const transport = new StdioClientTransport({ command: cmd, args });
    return this.capture(transport, "stdio");
  }

  static async fromHttp(url: string): Promise<ServerSnapshot> {
    const transport = new StreamableHTTPClientTransport(new URL(url));
    return this.capture(transport, "http");
  }

  private static async capture(
    transport: Parameters<Client["connect"]>[0],
    source: "stdio" | "http"
  ): Promise<ServerSnapshot> {
    const client = new Client({ name: "mcplint", version: "0.1.0" });
    await client.connect(transport);
    try {
      const tools: ToolDef[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.listTools(cursor ? { cursor } : undefined);
        tools.push(...(page.tools as ToolDef[]));
        cursor = page.nextCursor;
      } while (cursor);
      const serverVersion = client.getServerVersion();
      return {
        serverInfo: serverVersion
          ? { name: serverVersion.name, version: serverVersion.version }
          : undefined,
        tools,
        capturedAt: new Date().toISOString(),
        source
      };
    } finally {
      await client.close();
    }
  }

  static splitCommand(command: string): string[] {
    const parts: string[] = [];
    const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(command)) !== null) {
      parts.push(match[1] ?? match[2] ?? match[3]!);
    }
    return parts;
  }
}
