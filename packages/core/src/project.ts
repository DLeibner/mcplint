import { Scorer } from "./scoring.js";
import type {
  Category,
  FindingCounts,
  LintReport,
  ReportSummary,
  ResolvedFinding,
  Severity,
  Tier
} from "./types.js";

const SEVERITIES: Severity[] = ["error", "warn", "info"];

export function countFindings(findings: ResolvedFinding[]): FindingCounts {
  const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
  const byCategory = Object.fromEntries(
    Scorer.categories.map((c) => [c, 0])
  ) as Record<Category, number>;
  for (const finding of findings) {
    bySeverity[finding.severity]++;
    byCategory[finding.category]++;
  }
  return { bySeverity, byCategory };
}

/**
 * Project a report for a given entitlement tier.
 *
 * `"full"` returns the report untouched — this is what every caller passes today.
 * `"free"` withholds the findings themselves (the audit) while keeping the score,
 * the category breakdown, the token stats, and the counts, so the reader still
 * learns *that* they have twelve warnings without learning *what* they are.
 */
export function projectReport(report: LintReport, tier: Tier): LintReport | ReportSummary {
  if (tier === "full") return report;
  const { findings, ...rest } = report;
  return { ...rest, findingCounts: countFindings(findings), gated: true };
}

export function isGated(report: LintReport | ReportSummary): report is ReportSummary {
  return "gated" in report;
}
