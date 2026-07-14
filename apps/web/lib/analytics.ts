"use client";

import posthog from "posthog-js";

let started = false;

/**
 * PostHog, initialised lazily and only when a key is configured — so local dev
 * and self-hosting produce no network traffic at all.
 *
 * We never send report contents, server names, or tool schemas. Only the shape
 * of the interaction: which mode was used, whether it worked, what it scored.
 */
export function initAnalytics(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || started || typeof window === "undefined") return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    person_profiles: "always",
    capture_pageview: true
  });
  started = true;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || typeof window === "undefined") return;
  posthog.capture(event, properties);
}
