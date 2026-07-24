import { describe, expect, it } from "vitest";
import { humanizeCaptureError } from "./capture-error";

describe("humanizeCaptureError", () => {
  it("explains OAuth invalid_token from the target MCP server", () => {
    const message = humanizeCaptureError(
      new Error(
        'Streamable HTTP error: Error POSTing to endpoint: {"error":"invalid_token","error_description":"Missing or invalid access token"}'
      )
    );
    expect(message).toContain("requires authentication");
    expect(message).toContain("Optional request headers");
    expect(message).not.toContain("/api/lint");
  });

  it("explains Hotel Universe style auth errors", () => {
    const message = humanizeCaptureError(
      new Error(
        'Streamable HTTP error: Error POSTing to endpoint: {"object":"error","name":"AuthenticationRequiredError","message":"Authentication required"}'
      )
    );
    expect(message).toContain("requires authentication");
  });

  it("passes through non-transport errors unchanged", () => {
    expect(humanizeCaptureError(new Error("Only https:// endpoints are supported."))).toBe(
      "Only https:// endpoints are supported."
    );
  });
});
