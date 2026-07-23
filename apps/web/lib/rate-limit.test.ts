import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("rate-limit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("imports without initializing Upstash when env vars are missing", async () => {
    const mod = await import("./rate-limit");
    expect(mod.isRateLimitingEnabled()).toBe(false);
    await expect(mod.checkRateLimit("paste", "test-key")).resolves.toEqual({
      ok: true,
      remaining: Number.POSITIVE_INFINITY,
      resetAt: 0
    });
  });

  it("imports without initializing Upstash when the URL is a placeholder", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "[SENSITIVE]");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");

    const mod = await import("./rate-limit");
    expect(mod.isRateLimitingEnabled()).toBe(false);
    await expect(mod.checkRateLimit("url", "test-key")).resolves.toEqual({
      ok: true,
      remaining: Number.POSITIVE_INFINITY,
      resetAt: 0
    });
  });

  it("fails closed in production when Upstash is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const mod = await import("./rate-limit");
    await expect(mod.checkRateLimit("paste", "test-key")).resolves.toEqual({
      ok: false,
      remaining: 0,
      resetAt: 0,
      reason: "not_configured"
    });
  });

  it("treats non-https Upstash URLs as not configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "redis://127.0.0.1:6379");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");

    const mod = await import("./rate-limit");
    expect(mod.isRateLimitingEnabled()).toBe(false);
  });
});
