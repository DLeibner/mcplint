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
 * With no Upstash credentials configured, limiting is disabled in local dev.
 * In production we fail closed for both modes — unbounded paste linting is
 * still CPU-heavy and persisted to the report store.
 */
type Limiters = {
  url: Ratelimit;
  paste: Ratelimit;
};

let limitersCache: Limiters | undefined | null = null;

function isUpstashConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return Boolean(url && token && url.startsWith("https://"));
}

function getLimiters(): Limiters | undefined {
  if (limitersCache !== null) {
    return limitersCache;
  }

  if (!isUpstashConfigured()) {
    limitersCache = undefined;
    return undefined;
  }

  try {
    const redis = Redis.fromEnv();
    limitersCache = {
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
    };
    return limitersCache;
  } catch (error) {
    console.error("Upstash Redis client init failed", error);
    limitersCache = undefined;
    return undefined;
  }
}

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
  const limiters = getLimiters();
  if (!limiters) {
    if (process.env.NODE_ENV === "production") {
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
  return isUpstashConfigured();
}
