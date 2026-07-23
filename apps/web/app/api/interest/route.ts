import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { interest } from "@/lib/db/schema";

export const runtime = "nodejs";

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

const schema = z.object({
  email: z.string().email(),
  runId: z.string().max(16).optional(),
  note: z.string().max(500).optional()
});

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  // No database locally — the PostHog event is the signal that matters, and we
  // would rather drop the address than pretend to have stored it.
  if (!process.env.DATABASE_URL) return NextResponse.json({ ok: true, stored: false });

  await getDb()
    .insert(interest)
    .values({
      id: nanoid(),
      email: parsed.data.email,
      runId: parsed.data.runId ?? null,
      note: parsed.data.note ?? null
    });

  return NextResponse.json({ ok: true, stored: true });
}
