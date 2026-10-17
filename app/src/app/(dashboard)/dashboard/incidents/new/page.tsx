import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewIncidentForm } from "@/components/dashboard/incident-forms";
import { DashHeader, Panel } from "@/components/dashboard/ui";
import { requireDashboardUser } from "@/lib/dashboard";
import { getUserMonitorsCached } from "@/lib/dashboard-data";
import { effectiveStatus } from "@/lib/dashboard-view";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.incidents.report") };
}

export default async function NewIncidentPage({ searchParams }: { searchParams: Promise<{ monitor?: string }> }) {
  const user = await requireDashboardUser();
  const [query, t, monitors] = await Promise.all([searchParams, getT(), getUserMonitorsCached(user.id)]);
  const pre = monitors.find((m) => m.id === Number(query.monitor));
  return (
    <>
      <Link href="/dashboard/incidents" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("dash.nav.incidents")}
      </Link>
      <DashHeader title={t("dash.incidents.report")} description={t("dash.incident.newText")} />
      <Panel className="max-w-3xl">
        <NewIncidentForm
          monitors={monitors.map((m) => ({ id: m.id, name: m.name, type: m.type, status: effectiveStatus(m) }))}
          preselected={pre ? [pre.id] : []}
        />
      </Panel>
    </>
  );
}
