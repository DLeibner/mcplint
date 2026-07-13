import { readFile, writeFile } from "node:fs/promises";
import type { ServerSnapshot } from "../types.js";
import { snapshotFileSchema } from "./snapshot-schema.js";
import { McpCapture } from "./mcp-capture.js";

export interface IngestRequest {
  target?: string;
  stdio?: string;
}

export class SnapshotLoader {
  static async ingest(request: IngestRequest): Promise<ServerSnapshot> {
    if (request.stdio) return McpCapture.fromStdio(request.stdio);
    if (!request.target) {
      throw new Error("Provide a target (URL or snapshot file) or --stdio <command>.");
    }
    if (/^https?:\/\//.test(request.target)) return McpCapture.fromHttp(request.target);
    return this.fromFile(request.target);
  }

  static async fromFile(path: string): Promise<ServerSnapshot> {
    const raw = JSON.parse(await readFile(path, "utf8"));
    const parsed = snapshotFileSchema.parse(raw);
    return {
      serverInfo: parsed.serverInfo,
      tools: parsed.tools as ServerSnapshot["tools"],
      capturedAt: parsed.capturedAt ?? new Date().toISOString(),
      source: "file"
    };
  }

  static async dump(snapshot: ServerSnapshot, path: string): Promise<void> {
    await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  }
}
