import os from "os";
import { PostHog } from "posthog-node";

export const posthog = new PostHog(process.env.POSTHOG_API_KEY ?? "", {
  host: process.env.POSTHOG_HOST,
  flushAt: 1,
  flushInterval: 0,
  enableExceptionAutocapture: true,
  isServer: false,
});

export const distinctId = os.hostname();
