import { createHash, randomBytes } from "node:crypto";
import { customAlphabet } from "nanoid";
import { and, eq, sql } from "drizzle-orm";
import type { LintReport, ServerSnapshot } from "mcp-surface-lint";
import { runFindings, runs } from "./db/schema";
import { getDb } from "./db/client";

/** Unguessable but URL-friendly. 12 chars of this alphabet ≈ 62 bits. */
const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 12);

export type Visibility = "unlisted" | "public";

export interface StoredRun {
  id: string;
  createdAt: Date;
  report: LintReport;
  visibility: Visibility;
}

export interface CreateRunInput {
  report: LintReport;
  snapshot: ServerSnapshot;
  ingestMethod: "paste" | "url";
  durationMs: number;
  ipHash?: string;
  engineVersion: string;
}

export interface CreatedRun {
  id: string;
  /** Raw token, returned once, stored only as a hash. Lets the creator delete the run. */
  deleteToken: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "mcplint-dev-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

const PURGE_AFTER_DAYS = 30;

function findingCountRows(id: string, report: LintReport) {
  const counts = new Map<string, number>();
  for (const finding of report.findings) {
    const key = JSON.stringify([finding.ruleId, finding.severity]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => {
    const [ruleId, severity] = JSON.parse(key) as [string, string];
    return { runId: id, ruleId, severity, count };
  });
}

/**
 * Persistence for lint runs.
 *
 * Falls back to an in-memory map when `DATABASE_URL` is unset so the app runs
 * with `npm run dev` and no cloud account. Anything written this way disappears on
 * restart, which is exactly what you want locally and never what you want in prod.
 */
export interface Store {
  create(input: CreateRunInput): Promise<CreatedRun>;
  get(id: string): Promise<StoredRun | null>;
  setVisibility(id: string, visibility: Visibility, deleteToken: string): Promise<boolean>;
  remove(id: string, deleteToken: string): Promise<boolean>;
}

type MemoryRow = StoredRun & { deleteTokenHash: string };

/**
 * Next bundles route handlers and pages separately, so a plain module-level Map
 * would give each bundle its own copy — a run written by /api/lint would then be
 * invisible to /r/[id]. Hanging it off globalThis keeps one map per process, and
 * survives HMR too.
 */
const memoryRows: Map<string, MemoryRow> = ((globalThis as Record<string, unknown>)
  .__mcplintRuns ??= new Map<string, MemoryRow>()) as Map<string, MemoryRow>;

class MemoryStore implements Store {
  private readonly rows = memoryRows;

  async create(input: CreateRunInput): Promise<CreatedRun> {
    const id = nanoid();
    const deleteToken = randomBytes(24).toString("base64url");
    this.rows.set(id, {
      id,
      createdAt: new Date(),
      report: input.report,
      visibility: "unlisted",
      deleteTokenHash: hashToken(deleteToken)
    });
    return { id, deleteToken };
  }

  async get(id: string): Promise<StoredRun | null> {
    const row = this.rows.get(id);
    return row
      ? {
          id: row.id,
          createdAt: row.createdAt,
          report: row.report,
          visibility: row.visibility
        }
      : null;
  }

  async setVisibility(
    id: string,
    visibility: Visibility,
    deleteToken: string
  ): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.deleteTokenHash !== hashToken(deleteToken)) return false;
    row.visibility = visibility;
    return true;
  }

  async remove(id: string, deleteToken: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.deleteTokenHash !== hashToken(deleteToken)) return false;
    return this.rows.delete(id);
  }
}

class PostgresStore implements Store {
  async create(input: CreateRunInput): Promise<CreatedRun> {
    const db = getDb();
    const id = nanoid();
    const deleteToken = randomBytes(24).toString("base64url");
    const { report, snapshot } = input;
    const purgeAt = new Date(Date.now() + PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000);

    await db.insert(runs).values({
      id,
      ingestMethod: input.ingestMethod,
      serverName: report.server.name ?? null,
      serverVersion: report.server.version ?? null,
      toolCount: report.stats.toolCount,
      approxTokens: report.stats.approxTokens,
      composite: report.scores.composite,
      surface: report.scores.categories.surface,
      naming: report.scores.categories.naming,
      descriptions: report.scores.categories.descriptions,
      schemas: report.scores.categories.schemas,
      annotations: report.scores.categories.annotations,
      design: report.scores.categories.design,
      report,
      snapshot,
      visibility: "unlisted",
      deleteTokenHash: hashToken(deleteToken),
      ipHash: input.ipHash ?? null,
      durationMs: input.durationMs,
      engineVersion: input.engineVersion,
      purgeAt
    });

    const rows = findingCountRows(id, report);
    if (rows.length > 0) await db.insert(runFindings).values(rows);

    return { id, deleteToken };
  }

  async get(id: string): Promise<StoredRun | null> {
    const db = getDb();
    const [row] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
    if (!row) return null;
    return {
      id: row.id,
      createdAt: row.createdAt,
      report: row.report as LintReport,
      visibility: row.visibility as Visibility
    };
  }

  async setVisibility(
    id: string,
    visibility: Visibility,
    deleteToken: string
  ): Promise<boolean> {
    const db = getDb();
    // A public run outlives the purge window; an unlisted one is on the clock.
    const purgeAt =
      visibility === "public"
        ? null
        : new Date(Date.now() + PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const result = await db
      .update(runs)
      .set({ visibility, purgeAt })
      .where(and(eq(runs.id, id), eq(runs.deleteTokenHash, hashToken(deleteToken))))
      .returning({ id: runs.id });
    return result.length > 0;
  }

  async remove(id: string, deleteToken: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(runs)
      .where(and(eq(runs.id, id), eq(runs.deleteTokenHash, hashToken(deleteToken))))
      .returning({ id: runs.id });
    return result.length > 0;
  }
}

/** Deletes expired unlisted runs. Called by the cron route. */
export async function purgeExpired(): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;
  const db = getDb();
  const result = await db
    .delete(runs)
    .where(and(eq(runs.visibility, "unlisted"), sql`${runs.purgeAt} < now()`))
    .returning({ id: runs.id });
  return result.length;
}

let cached: Store | undefined;

export function getStore(): Store {
  if (!cached) {
    cached = process.env.DATABASE_URL ? new PostgresStore() : new MemoryStore();
  }
  return cached;
}
