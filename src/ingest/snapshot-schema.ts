import { z } from "zod";

const toolDefSchema = z
  .object({
    name: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    inputSchema: z.record(z.unknown()).optional(),
    outputSchema: z.record(z.unknown()).optional(),
    annotations: z.record(z.unknown()).optional()
  })
  .passthrough();

export const snapshotFileSchema = z
  .object({
    serverInfo: z.object({ name: z.string().optional(), version: z.string().optional() }).optional(),
    tools: z.array(toolDefSchema),
    capturedAt: z.string().optional(),
    source: z.enum(["stdio", "http", "file"]).optional()
  })
  .passthrough();

export type SnapshotFile = z.infer<typeof snapshotFileSchema>;
