import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { projectReport } from "mcplint";
import { ReportView } from "@/components/ReportView";
import { ShareControls } from "@/components/ShareControls";
import { AuditCta } from "@/components/AuditCta";
import { currentTier } from "@/lib/lint";
import { getStore } from "@/lib/store";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const run = await getStore().get(id);
  if (!run) return { title: "Report not found — mcplint" };

  const isPublic = run.visibility === "public";
  return {
    title: `${run.report.server.name ?? "MCP server"} — ${run.report.scores.composite}/100 — mcplint`,
    // Private by default means private from crawlers too, not just from the
    // directory. An unlisted report must never end up in a search index.
    robots: isPublic ? undefined : { index: false, follow: false }
  };
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params;
  const run = await getStore().get(id);
  if (!run) notFound();

  const jar = await cookies();
  const isOwner = Boolean(jar.get(`mcplint_owner_${id}`));

  return (
    <main>
      <ReportView report={projectReport(run.report, currentTier())} />
      {isOwner && <ShareControls id={id} initialVisibility={run.visibility} />}
      <AuditCta id={id} />
    </main>
  );
}
