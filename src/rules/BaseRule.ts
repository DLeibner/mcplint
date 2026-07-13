import type {
  Category,
  Finding,
  JsonSchema,
  Rule,
  RuleOptions,
  ServerSnapshot,
  Severity,
  ToolDef
} from "../types.js";

export interface SchemaNode {
  schema: JsonSchema;
  path: string;
  depth: number;
}

export abstract class BaseRule implements Rule {
  abstract readonly id: string;
  abstract readonly category: Category;
  abstract readonly severity: Severity;
  abstract readonly weight: number;
  abstract readonly docsUrl: string;
  abstract readonly rationale: string;
  readonly defaultOptions: RuleOptions = {};

  get maxDeduction(): number {
    return this.weight * 4;
  }

  abstract check(snapshot: ServerSnapshot, options: RuleOptions): Finding[];

  protected finding(f: Omit<Finding, "ruleId">): Finding {
    return { ruleId: this.id, ...f };
  }

  protected opt<T>(options: RuleOptions, key: string): T {
    return (options[key] ?? this.defaultOptions[key]) as T;
  }

  protected static nameTokens(name: string): string[] {
    return name
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  }

  protected static description(tool: ToolDef): string {
    return tool.description?.trim() ?? "";
  }

  protected static properties(schema: JsonSchema | undefined): Record<string, JsonSchema> {
    const props = schema?.properties;
    if (props && typeof props === "object" && !Array.isArray(props)) {
      return props as Record<string, JsonSchema>;
    }
    return {};
  }

  protected static walkSchema(
    schema: unknown,
    visit: (node: SchemaNode) => void,
    path = "",
    depth = 0
  ): void {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) return;
    const node = schema as JsonSchema;
    visit({ schema: node, path, depth });
    for (const [key, child] of Object.entries(this.properties(node))) {
      this.walkSchema(child, visit, `${path}/properties/${key}`, depth + 1);
    }
    if (node.items && typeof node.items === "object" && !Array.isArray(node.items)) {
      this.walkSchema(node.items, visit, `${path}/items`, depth + 1);
    }
    for (const comb of ["oneOf", "anyOf", "allOf"] as const) {
      const branches = node[comb];
      if (Array.isArray(branches)) {
        branches.forEach((sub, i) => this.walkSchema(sub, visit, `${path}/${comb}/${i}`, depth));
      }
    }
  }

  protected static words(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9'\s]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  protected static sentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  protected static trigrams(text: string): Set<string> {
    const norm = text
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const grams = new Set<string>();
    for (let i = 0; i <= norm.length - 3; i++) grams.add(norm.slice(i, i + 3));
    return grams;
  }

  protected static jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const gram of a) if (b.has(gram)) intersection++;
    return intersection / (a.size + b.size - intersection);
  }

  protected static normalizeParamName(name: string): string {
    return name.toLowerCase().replace(/[_-]/g, "");
  }

  protected static readonly MUTATING_VERBS = new Set([
    "create", "add", "update", "set", "delete", "remove", "cancel", "accept",
    "reject", "approve", "request", "enable", "disable", "link", "unlink",
    "pull", "refresh", "make", "save", "combine", "append", "change",
    "checkout", "reactivate", "send", "write", "post", "put", "patch",
    "assign", "revoke", "invite", "upload", "import", "move", "rename",
    "archive", "restore", "execute", "run", "start", "stop", "pause",
    "resume", "publish", "submit", "grant"
  ]);
}
