import { describe, expect, it, vi } from "vitest";
import { McpCapture } from "../src/ingest/mcp-capture.js";

describe("McpCapture.fromHttp", () => {
  it("forwards optional Authorization headers on outbound fetch", async () => {
    const seen: string[] = [];
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const headers = init?.headers;
      if (headers instanceof Headers) {
        seen.push(headers.get("Authorization") ?? "");
      } else if (headers && typeof headers === "object") {
        seen.push(String((headers as Record<string, string>).Authorization ?? ""));
      }
      return new Response("unauthorized", { status: 401, statusText: "Unauthorized" });
    });

    await expect(
      McpCapture.fromHttp("https://example.com/mcp", {
        fetch: fetchMock as typeof fetch,
        headers: { Authorization: "Bearer test-token" }
      })
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalled();
    expect(seen.some((value) => value === "Bearer test-token")).toBe(true);
  });
});
