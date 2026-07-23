import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

const severitySchema = z.enum(["info", "warn", "error"]);

const ruleSettingSchema = z.union([
  z.literal("off"),
  severitySchema,
  z.object({
    severity: severitySchema.optional(),
    options: z.record(z.unknown()).optional()
  })
]);

export const configSchema = z.object({
  rules: z.record(ruleSettingSchema).default({}),
  failUnder: z.number().min(0).max(100).optional()
});

export type McplintConfig = z.infer<typeof configSchema>;
export type RuleSetting = z.infer<typeof ruleSettingSchema>;

export class ConfigLoader {
  static readonly defaultFileName = ".mcplintrc.json";

  static empty(): McplintConfig {
    return configSchema.parse({});
  }

  static async load(explicitPath?: string, cwd = process.cwd()): Promise<McplintConfig> {
    const path = explicitPath ?? resolve(cwd, this.defaultFileName);
    if (!explicitPath && !(await this.exists(path))) return this.empty();
    const raw = await readFile(path, "utf8");
    return configSchema.parse(JSON.parse(raw));
  }

  private static async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
}
