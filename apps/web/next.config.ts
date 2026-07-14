import type { NextConfig } from "next";

const config: NextConfig = {
  // `mcplint` is a workspace source package, and the MCP SDK it pulls in is
  // Node-only. Keep both out of the client bundle and let Next transpile the
  // workspace package rather than treating it as a prebuilt dep.
  transpilePackages: ["mcplint"],
  serverExternalPackages: ["@modelcontextprotocol/sdk", "gpt-tokenizer", "undici"]
};

export default config;
