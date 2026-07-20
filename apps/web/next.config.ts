import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const siteOrigin =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const config: NextConfig = {
  // `mcplint` is a workspace source package, and the MCP SDK it pulls in is
  // Node-only. Keep both out of the client bundle and let Next transpile the
  // workspace package rather than treating it as a prebuilt dep.
  transpilePackages: ["mcplint"],
  serverExternalPackages: ["@modelcontextprotocol/sdk", "gpt-tokenizer", "undici"],
  outputFileTracingRoot: path.resolve(appRoot, "../.."),
  env: {
    MCPLINT_DOCS_BASE: `${siteOrigin.replace(/\/$/, "")}/rules`
  }
};

export default config;
