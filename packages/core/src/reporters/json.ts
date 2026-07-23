import type { LintReport } from "../types.js";

export class JsonReporter {
  render(report: LintReport): string {
    return JSON.stringify(report, null, 2);
  }
}
