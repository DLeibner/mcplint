import type { Category, CategoryScores, Grade, ResolvedFinding, Rule } from "./types.js";

export class Scorer {
  static readonly categories: Category[] = [
    "surface",
    "naming",
    "descriptions",
    "schemas",
    "annotations",
    "design"
  ];

  /** Presentational only — never feeds back into the composite. */
  static grade(composite: number): Grade {
    if (composite >= 90) return "A";
    if (composite >= 80) return "B";
    if (composite >= 70) return "C";
    if (composite >= 60) return "D";
    return "F";
  }

  constructor(private readonly rules: Rule[]) {}

  score(findings: ResolvedFinding[]): { composite: number; categories: CategoryScores } {
    const categories = {} as CategoryScores;
    for (const category of Scorer.categories) {
      categories[category] = this.categoryScore(category, findings);
    }
    const active = Scorer.categories.filter((c) =>
      this.rules.some((rule) => rule.category === c)
    );
    const composite =
      active.length === 0
        ? 100
        : Math.round(active.reduce((sum, c) => sum + categories[c], 0) / active.length);
    return { composite, categories };
  }

  private categoryScore(category: Category, findings: ResolvedFinding[]): number {
    let deduction = 0;
    for (const rule of this.rules) {
      if (rule.category !== category) continue;
      const counted = findings.filter(
        (f) => f.ruleId === rule.id && f.severity !== "info"
      ).length;
      if (counted === 0) continue;
      deduction += Math.min(rule.weight * counted, rule.maxDeduction);
    }
    return Math.max(0, Math.round(100 - deduction));
  }
}
