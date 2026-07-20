import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limits, keyed on hashed IP.
 *
 * `url` mode is the one that matters: without a limit, our server will fetch any
 * address on demand for anyone, which makes us a free traffic amplifier pointed
 * at a victim of the caller's choosing. `paste` mode touches nobody else's
 * network, so it only needs to be bounded against CPU abuse.
 *
 * With no Upstash credentials configured (local dev), limiting is disabled
 * rather than failing closed — a dev machine is not a public amplifier.
 */
const configured =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = configured ? Redis.fromEnv() : undefined;

const limiters = redis
  ? {
      url: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 h"),
        prefix: "mcplint:url",
        analytics: true
      }),
      paste: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "1 h"),
        prefix: "mcplint:paste",
        analytics: true
      })
    }
  : undefined;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  reason?: "limit_reached" | "not_configured";
}

export async function checkRateLimit(
  mode: "paste" | "url",
  key: string
): Promise<RateLimitResult> {
  if (!limiters) {
    if (mode === "url" && process.env.NODE_ENV === "production") {
      return { ok: false, remaining: 0, resetAt: 0, reason: "not_configured" };
    }
    return { ok: true, remaining: Number.POSITIVE_INFINITY, resetAt: 0 };
  }
  const { success, remaining, reset } = await limiters[mode].limit(key);
  return {
    ok: success,
    remaining,
    resetAt: reset,
    reason: success ? undefined : "limit_reached"
  };
}

export function isRateLimitingEnabled(): boolean {
  return Boolean(limiters);
}
