import { BaseRule } from "./BaseRule.js";
import { Docs } from "./docs.js";
import type { Finding, RuleOptions, ServerSnapshot } from "../types.js";

class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]!]!;
      i = this.parent[i]!;
    }
    return i;
  }

  union(a: number, b: number): void {
    this.parent[this.find(a)] = this.find(b);
  }
}

export class DesignOverlapCluster extends BaseRule {
  readonly id = "design/overlap-cluster";
  readonly category = "design" as const;
  readonly severity = "warn" as const;
  readonly weight = 4;
  readonly docsUrl = Docs.rule("design/overlap-cluster");
  readonly rationale =
    "Tools whose descriptions substantially overlap force the model to pick between " +
    "near-synonyms — the classic cause of wrong-tool calls. Clusters are usually one " +
    "tool wearing several names; consolidate with include-flags or a mode parameter.";
  override readonly defaultOptions = { similarity: 0.55, minPrefixCluster: 3 };

  check(snapshot: ServerSnapshot, options: RuleOptions): Finding[] {
    const similarity = this.opt<number>(options, "similarity");
    const minPrefixCluster = this.opt<number>(options, "minPrefixCluster");
    const findings: Finding[] = [];

    const byPrefix = new Map<string, string[]>();
    for (const tool of snapshot.tools) {
      const tokens = BaseRule.nameTokens(tool.name);
      if (tokens.length < 2) continue;
      const prefix = tokens.slice(0, 2).join("_");
      byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), tool.name]);
    }
    for (const [prefix, members] of byPrefix) {
      if (members.length < minPrefixCluster) continue;
      findings.push(
        this.finding({
          message: `${members.length} tools share the name prefix "${prefix}" — likely one tool with include-flags or a mode parameter.`,
          evidence: members.join(", ")
        })
      );
    }

    const described = snapshot.tools.filter((t) => BaseRule.description(t).length >= 40);
    const grams = described.map((t) => BaseRule.trigrams(BaseRule.description(t)));
    const uf = new UnionFind(described.length);
    const pairScores = new Map<string, number>();
    for (let i = 0; i < described.length; i++) {
      for (let j = i + 1; j < described.length; j++) {
        const score = BaseRule.jaccard(grams[i]!, grams[j]!);
        if (score >= similarity) {
          uf.union(i, j);
          pairScores.set(`${i}:${j}`, score);
        }
      }
    }
    const clusters = new Map<number, number[]>();
    for (let i = 0; i < described.length; i++) {
      const root = uf.find(i);
      clusters.set(root, [...(clusters.get(root) ?? []), i]);
    }
    for (const members of clusters.values()) {
      if (members.length < 2) continue;
      const names = members.map((i) => described[i]!.name);
      const scores = [...pairScores.entries()]
        .filter(([key]) => key.split(":").every((idx) => members.includes(Number(idx))))
        .map(([, score]) => score);
      const max = Math.max(...scores);
      findings.push(
        this.finding({
          message: `${names.length} tools have overlapping descriptions (trigram Jaccard up to ${max.toFixed(2)}) — consolidation candidates.`,
          evidence: names.join(", ")
        })
      );
    }

    return findings;
  }
}
