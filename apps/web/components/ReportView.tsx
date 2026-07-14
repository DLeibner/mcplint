import { Scorer, isGated, type LintReport, type ReportSummary, type Severity } from "mcplint";

const SEVERITY_ORDER: Severity[] = ["error", "warn", "info"];

function scoreColor(score: number): string {
  if (score >= 90) return "var(--good)";
  if (score >= 50) return "var(--warn)";
  return "var(--error)";
}

export function ReportView({ report }: { report: LintReport | ReportSummary }) {
  const { composite, categories } = report.scores;
  const grade = Scorer.grade(composite);

  return (
    <>
      {/* The headline is the token bill, not the score. It is the thing nobody
          has measured and the thing that costs money on every single turn. */}
      <blockquote className="footprint">
        <div className="big">
          ~{report.stats.approxTokens.toLocaleString()} tokens per conversation
        </div>
        <div className="sub">
          {report.stats.toolCount} tools, injected before the user says anything ·{" "}
          {report.stats.encoding}, approximate
        </div>
      </blockquote>

      <div className="score-head">
        <div className="grade" style={{ color: scoreColor(composite) }}>
          {grade}
        </div>
        <div>
          <div className="composite">{composite}/100</div>
          <div className="sub" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            {report.server.name ?? "unnamed server"}
            {report.server.version ? ` v${report.server.version}` : ""}
          </div>
        </div>
      </div>

      <div className="cats">
        {Scorer.categories.map((category) => {
          const score = categories[category];
          return (
            <div className="cat" key={category}>
              <span className="name">{category}</span>
              <span className="bar">
                <i style={{ width: `${score}%`, background: scoreColor(score) }} />
              </span>
              <span className="val">{score}</span>
            </div>
          );
        })}
      </div>

      {isGated(report) ? (
        <GatedFindings report={report} />
      ) : (
        <Findings report={report} />
      )}
    </>
  );
}

function Findings({ report }: { report: LintReport }) {
  const counts = SEVERITY_ORDER.map(
    (severity) => report.findings.filter((f) => f.severity === severity).length
  );

  if (report.findings.length === 0) {
    return (
      <>
        <h2>Findings</h2>
        <p className="lede">Nothing to flag. This surface is clean.</p>
      </>
    );
  }

  return (
    <>
      <h2>Findings</h2>
      <p className="counts">
        {counts[0]} errors · {counts[1]} warnings · {counts[2]} info
      </p>

      {SEVERITY_ORDER.map((severity) => {
        const group = report.findings.filter((f) => f.severity === severity);
        if (group.length === 0) return null;
        return (
          <section key={severity} style={{ marginTop: "1.5rem" }}>
            {group.map((finding, i) => (
              <article className={`finding ${severity}`} key={`${finding.ruleId}-${i}`}>
                <div className="meta">
                  <span className={`badge ${severity}`}>{severity}</span>
                  <a className="rule-id" href={finding.docsUrl} target="_blank" rel="noreferrer">
                    {finding.ruleId}
                  </a>
                  {finding.toolName && <span className="tool-name">{finding.toolName}</span>}
                </div>
                <div className="msg">{finding.message}</div>
                {finding.evidence && <p className="evidence">{finding.evidence}</p>}
              </article>
            ))}
          </section>
        );
      })}
    </>
  );
}

/**
 * Rendered only when GATE_FINDINGS is on — which it is not in v1. Kept wired so
 * the paywall is a config flip, not a feature build.
 */
function GatedFindings({ report }: { report: ReportSummary }) {
  const { bySeverity } = report.findingCounts;
  return (
    <>
      <h2>Findings</h2>
      <p className="counts">
        {bySeverity.error} errors · {bySeverity.warn} warnings · {bySeverity.info} info
      </p>
      <div className="panel" style={{ marginTop: "1rem" }}>
        <p className="hint">The detailed audit is not included on this plan.</p>
      </div>
    </>
  );
}
