import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Trash } from "lucide-react";
import { deleteIncidentAction } from "@/app/actions/dashboard/incidents";
import { ActionButton } from "@/components/dashboard/actions";
import { MaintenanceForm } from "@/components/dashboard/incident-forms";
import { LocalTime } from "@/components/dashboard/local-time";
import { IncidentStatusBadge } from "@/components/dashboard/monitor-meta";
import { DashHeader, Panel } from "@/components/dashboard/ui";
import { Alert } from "@/components/ui/alert";
import { requireDashboardUser } from "@/lib/dashboard";
import { formatDateTime, maintenancePhase } from "@/lib/dash-format";
import { getUserMonitorsCached } from "@/lib/dashboard-data";
import { effectiveStatus } from "@/lib/dashboard-view";
import { getLocale, getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { getIncidentMonitorIds, getIncidentUpdates, getOwnedIncident } from "@/lib/incidents";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.maint.editTitle") };
}

export default async function MaintenanceWindowPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireDashboardUser();
  const incident = await getOwnedIncident(Number((await params).id), user.id);
  if (!incident) notFound();
  if (incident.kind !== "maintenance") redirect(`/dashboard/incidents/${incident.id}`);
  const [t, locale, monitors, monitorMap, updatesMap] = await Promise.all([
    getT(),
    getLocale(),
    getUserMonitorsCached(user.id),
    getIncidentMonitorIds([incident.id]),
    getIncidentUpdates([incident.id]),
  ]);
  const phase = maintenancePhase(incident);
  const updates = updatesMap.get(incident.id) ?? [];
  const start = incident.scheduled_start ?? incident.started_at;
  const end = incident.scheduled_end ?? incident.started_at;

  return (
    <>
      <Link href="/dashboard/maintenance" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("dash.nav.maintenance")}
      </Link>
      <DashHeader
        title={incident.title}
        description={<LocalTime iso={start} end={end} locale={locale.code} />}
        actions={
          <ActionButton
            action={deleteIncidentAction}
            fields={{ incident_id: incident.id }}
            confirmText={t("dash.maint.deleteConfirm")}
            buttonClassName="hover:border-red-300 hover:text-red-600"
          >
            <Trash aria-hidden />
            {t("dash.incident.delete")}
          </ActionButton>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title={t("dash.maint.editTitle")}>
          {phase === "completed" ? (
            <Alert>{t("dash.maint.completedNotice")}</Alert>
          ) : (
            <MaintenanceForm
              values={{ id: incident.id, title: incident.title, start, end, monitorIds: monitorMap.get(incident.id) ?? [] }}
              monitors={monitors.map((m) => ({ id: m.id, name: m.name, type: m.type, status: effectiveStatus(m) }))}
            />
          )}
        </Panel>
        <Panel title={t("dash.incident.timeline")}>
          {updates.length ? (
            <ol className="space-y-4">
              {updates.map((u) => (
                <li key={u.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <IncidentStatusBadge status={u.status} label={t(`dash.istatus.${u.status}` as MessageKey)} />
                    <span className="text-xs text-muted">{formatDateTime(u.created_at, locale.code)}</span>
                  </div>
                  <p dir="auto" className="mt-1.5 text-sm break-words whitespace-pre-line">{u.message}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">{t("dash.incident.noUpdates")}</p>
          )}
        </Panel>
      </div>
    </>
  );
}
