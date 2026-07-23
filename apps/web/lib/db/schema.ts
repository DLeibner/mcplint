import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  varchar
} from "drizzle-orm/pg-core";

export const runs = pgTable(
  "runs",
  {
    id: varchar("id", { length: 16 }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

    ingestMethod: varchar("ingest_method", { length: 8 }).notNull(), // "paste" | "url"

    serverName: text("server_name"),
    serverVersion: text("server_version"),

    toolCount: integer("tool_count").notNull(),
    approxTokens: integer("approx_tokens").notNull(),

    composite: smallint("composite").notNull(),
    surface: smallint("surface").notNull(),
    naming: smallint("naming").notNull(),
    descriptions: smallint("descriptions").notNull(),
    schemas: smallint("schemas").notNull(),
    annotations: smallint("annotations").notNull(),
    design: smallint("design").notNull(),

    report: jsonb("report").notNull(),
    /** Retained only so a run can be re-linted after a rule change. Purged with the run. */
    snapshot: jsonb("snapshot"),

    /** "unlisted" (default, noindex, unguessable URL) | "public" (opt-in) */
    visibility: varchar("visibility", { length: 12 }).notNull().default("unlisted"),
    /** Bearer of this token may delete the run. Hashed — we never store the raw value. */
    deleteTokenHash: text("delete_token_hash").notNull(),

    ipHash: text("ip_hash"),
    durationMs: integer("duration_ms").notNull(),
    /**
     * The engine that produced this score. Without it, a rule-weight change is
     * indistinguishable from a real shift in server quality when we look back.
     */
    engineVersion: text("engine_version").notNull(),

    /** Unlisted runs are purged after 30 days. Public ones are kept. */
    purgeAt: timestamp("purge_at", { withTimezone: true })
  },
  (table) => [
    index("runs_created_at_idx").on(table.createdAt),
    index("runs_server_name_idx").on(table.serverName),
    index("runs_purge_at_idx").on(table.purgeAt)
  ]
);

/**
 * Denormalised finding counts, written alongside each run.
 *
 * "Which rules fire most often across all servers" is the single most valuable
 * question this product can answer — it tells us which rules are miscalibrated
 * and it is the raw material for anything we publish. Answering it by crawling
 * the `report` jsonb of every row would get slow fast; this makes it an index scan.
 */
export const runFindings = pgTable(
  "run_findings",
  {
    runId: varchar("run_id", { length: 16 })
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    ruleId: varchar("rule_id", { length: 64 }).notNull(),
    severity: varchar("severity", { length: 8 }).notNull(),
    count: integer("count").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.ruleId, table.severity] }),
    index("run_findings_rule_id_idx").on(table.ruleId)
  ]
);

/**
 * The demand test for the eventual paid tier.
 *
 * Rather than build billing to find out whether anyone wants this, we put a real
 * but inert call-to-action on the report page and count who asks to be told when
 * it exists. No payment is taken and nothing is promised. If this table stays
 * empty, that is the answer.
 */
export const interest = pgTable("interest", {
  id: varchar("id", { length: 16 }).primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  email: text("email").notNull(),
  runId: varchar("run_id", { length: 16 }),
  note: text("note")
});

export type RunRow = typeof runs.$inferSelect;
export type NewRunRow = typeof runs.$inferInsert;
