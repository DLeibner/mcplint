import { NextResponse } from "next/server";
import { projectReport } from "mcp-surface-lint";
import { currentTier } from "@/lib/lint";
import { getStore, type Visibility } from "@/lib/store";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function ownerToken(request: Request, id: string): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
  const target = `mcplint_owner_${id}=`;
  for (const part of cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) return trimmed.slice(target.length);
  }
  return undefined;
}

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const run = await getStore().get(id);
  if (!run) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({
    id: run.id,
    createdAt: run.createdAt,
    visibility: run.visibility,
    report: projectReport(run.report, currentTier()),
    isOwner: Boolean(ownerToken(request, id))
  });
}

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const token = ownerToken(request, id);
  if (!token) return NextResponse.json({ error: "Not your report." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { visibility?: string } | null;
  const visibility = body?.visibility;
  if (visibility !== "public" && visibility !== "unlisted") {
    return NextResponse.json({ error: "visibility must be 'public' or 'unlisted'." }, { status: 400 });
  }

  const ok = await getStore().setVisibility(id, visibility as Visibility, token);
  if (!ok) return NextResponse.json({ error: "Not your report." }, { status: 403 });
  return NextResponse.json({ id, visibility });
}

export async function DELETE(request: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const token = ownerToken(request, id);
  if (!token) return NextResponse.json({ error: "Not your report." }, { status: 403 });

  const ok = await getStore().remove(id, token);
  if (!ok) return NextResponse.json({ error: "Not your report." }, { status: 403 });
  return NextResponse.json({ deleted: id });
}
