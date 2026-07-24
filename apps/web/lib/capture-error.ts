/**
 * Turn MCP SDK transport failures into playground-friendly copy.
 * These errors come from the user-supplied MCP URL, not from mcplint's /api/lint or /api/mcp.
 */
export function humanizeCaptureError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  const payload = extractJsonPayload(raw);
  if (payload && isTargetAuthFailure(payload)) {
    return (
      "That MCP server rejected the connection because it requires authentication. " +
      "Remote audits connect from mcplint's server to your URL — they do not use your Cursor " +
      "session or browser cookies. If the endpoint expects a Bearer token or API key, add it " +
      'under Optional request headers as {"Authorization":"Bearer …"} (or the header name that ' +
      "server documents). For private credentials, use the CLI instead of the hosted playground."
    );
  }

  if (raw.includes("Streamable HTTP error")) {
    return (
      `${stripStreamablePrefix(raw)} ` +
      "(This response came from the MCP URL you entered, not from mcplint's /api/lint endpoint.)"
    );
  }

  return raw;
}

function stripStreamablePrefix(message: string): string {
  return message.replace(/^Streamable HTTP error:\s*/i, "").trim();
}

function extractJsonPayload(message: string): Record<string, unknown> | undefined {
  const start = message.indexOf("{");
  if (start === -1) return undefined;
  const candidate = message.slice(start);
  try {
    const parsed: unknown = JSON.parse(candidate);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Trailing text after JSON — try the common `Error POSTing to endpoint: {...}` shape.
  }

  const match = message.match(/(\{[\s\S]*\})/);
  if (!match) return undefined;
  try {
    const parsed: unknown = JSON.parse(match[1]!);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function isTargetAuthFailure(body: Record<string, unknown>): boolean {
  const errorCode = typeof body.error === "string" ? body.error : undefined;
  if (errorCode === "invalid_token" || errorCode === "invalid_client") return true;

  const name = typeof body.name === "string" ? body.name : undefined;
  if (name === "AuthenticationRequiredError" || name === "InvalidAuthenticationError") {
    return true;
  }

  const message = typeof body.message === "string" ? body.message.toLowerCase() : "";
  return message.includes("authentication required") || message.includes("unauthorized");
}
