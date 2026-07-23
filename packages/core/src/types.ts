export type JsonSchema = Record<string, unknown>;

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  [key: string]: unknown;
}

export interface ToolDef {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  [key: string]: unknown;
}

export interface ServerSnapshot {
  serverInfo?: { name?: string; version?: string };
  tools: ToolDef[];
  capturedAt: string;
  source: "stdio" | "http" | "file";
}

export type Severity = "error" | "warn" | "info";

export type Category =
  | "surface"
  | "naming"
  | "descriptions"
  | "schemas"
  | "annotations"
  | "design";

export interface Finding {
  ruleId: string;
  toolName?: string;
  path?: string;
  message: string;
  evidence?: string;
  severity?: Severity;
  positive?: boolean;
}

export type RuleOptions = Record<string, unknown>;

export interface Rule {
  id: string;
  category: Category;
  severity: Severity;
  weight: number;
  maxDeduction: number;
  docsUrl: string;
  rationale: string;
  defaultOptions: RuleOptions;
  check(snapshot: ServerSnapshot, options: RuleOptions): Finding[];
}

export interface ResolvedFinding extends Finding {
  severity: Severity;
  category: Category;
  docsUrl: string;
}

export interface CategoryScores {
  surface: number;
  naming: number;
  descriptions: number;
  schemas: number;
  annotations: number;
  design: number;
}

export interface LintReport {
  server: { name?: string; version?: string };
  source: string;
  capturedAt: string;
  stats: {
    toolCount: number;
    approxTokens: number;
    encoding: string;
  };
  scores: {
    composite: number;
    categories: CategoryScores;
  };
  findings: ResolvedFinding[];
}

/**
 * Letter grade derived from the composite. Presentational only — it is computed
 * on demand by `Scorer.grade()` and deliberately not stored on `LintReport`, so
 * the report payload stays the single source of truth for scoring.
 */
export type Grade = "A" | "B" | "C" | "D" | "F";

/**
 * Entitlement tier. Everything is "full" today; "free" exists so the eventual
 * score-free/details-paid split is a constant change rather than a rewrite of
 * the report pipeline. See `projectReport`.
 */
export type Tier = "free" | "full";

export interface FindingCounts {
  bySeverity: Record<Severity, number>;
  byCategory: Record<Category, number>;
}

/** A `LintReport` with the findings withheld — scores and stats survive. */
export interface ReportSummary extends Omit<LintReport, "findings"> {
  findingCounts: FindingCounts;
  gated: true;
}
