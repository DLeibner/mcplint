import pkg from "mcp-surface-lint/package.json" with { type: "json" };

/**
 * The engine that produced a given score. Stored on every run: when a rule's
 * weight changes, historical composites shift, and without this we could not
 * tell a real trend from a scoring change.
 */
export const ENGINE_VERSION: string = (pkg as { version: string }).version;
