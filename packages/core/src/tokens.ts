import { encode } from "gpt-tokenizer/encoding/o200k_base";
import type { ServerSnapshot, ToolDef } from "./types.js";

export class TokenCounter {
  static readonly encoding = "o200k_base";

  static count(text: string): number {
    return encode(text).length;
  }

  static tool(tool: ToolDef): number {
    return this.count(JSON.stringify(tool));
  }

  static snapshot(snapshot: ServerSnapshot): number {
    return this.count(JSON.stringify(snapshot.tools));
  }
}
