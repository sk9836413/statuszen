import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MaintenanceForm } from "@/components/dashboard/incident-forms";
import { DashHeader, Panel } from "@/components/dashboard/ui";
import { requireDashboardUser } from "@/lib/dashboard";
import { getUserMonitorsCached } from "@/lib/dashboard-data";
import { effectiveStatus } from "@/lib/dashboard-view";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.maint.schedule") };
}

export default async function NewMaintenancePage() {
  const user = await requireDashboardUser();
  const [t, monitors] = await Promise.all([getT(), getUserMonitorsCached(user.id)]);
  return (
    <>
      <Link href="/dashboard/maintenance" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("dash.nav.maintenance")}
      </Link>
      <DashHeader title={t("dash.maint.schedule")} description={t("dash.maint.newText")} />
      <Panel className="max-w-3xl">
        <MaintenanceForm
          values={{ title: "", start: null, end: null, monitorIds: [] }}
          monitors={monitors.map((m) => ({ id: m.id, name: m.name, type: m.type, status: effectiveStatus(m) }))}
        />
      </Panel>
    </>
  );
}
