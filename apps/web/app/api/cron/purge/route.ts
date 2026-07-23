import { NextResponse } from "next/server";
import { purgeExpired } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Deletes unlisted runs past their 30-day window.
 *
 * We tell people their report is auto-deleted. This is the code that makes that
 * true, so it is not optional decoration — if it stops running, we are lying on
 * the form.
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Vercel signs cron invocations; reject anything else so this is not a public
  // "delete a bunch of rows" button.
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    console.error("CRON_SECRET is required in production.");
    return NextResponse.json({ error: "Cron is not configured." }, { status: 503 });
  }
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const deleted = await purgeExpired();
  return NextResponse.json({ deleted });
}
