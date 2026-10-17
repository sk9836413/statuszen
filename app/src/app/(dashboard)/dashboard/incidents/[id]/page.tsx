import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Trash } from "lucide-react";
import { deleteIncidentAction } from "@/app/actions/dashboard/incidents";
import { ActionButton, RefreshOnce } from "@/components/dashboard/actions";
import { IncidentUpdateForm } from "@/components/dashboard/incident-forms";
import { ImpactBadge, IncidentStatusBadge, StatusDot } from "@/components/dashboard/monitor-meta";
import { Panel } from "@/components/dashboard/ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireDashboardUser } from "@/lib/dashboard";
import { formatDateTime, formatMs, formatRelative } from "@/lib/dash-format";
import { getUserMonitorsCached } from "@/lib/dashboard-data";
import { effectiveStatus } from "@/lib/dashboard-view";
import { getLocale, getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { getIncidentMonitorIds, getIncidentUpdates, getOwnedIncident, RESOLVED_STATUSES } from "@/lib/incidents";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/monitor/format";
import { parseJson } from "@/monitor/normalize";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await requireDashboardUser();
  const incident = await getOwnedIncident(Number((await params).id), user.id);
  return { title: incident?.title ?? "" };
}

const TIMELINE_DOT: Record<string, string> = {
  investigating: "bg-red-500",
  identified: "bg-orange-500",
  monitoring: "bg-amber-500",
  resolved: "bg-emerald-500",
  scheduled: "bg-blue-500",
  in_progress: "bg-amber-500",
  completed: "bg-emerald-500",
};

export default async function IncidentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireDashboardUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const incident = await getOwnedIncident(Number(id), user.id);
  if (!incident) notFound();
  if (incident.kind === "maintenance") redirect(`/dashboard/maintenance/${incident.id}`);

  const [t, locale, monitors, updatesMap, monitorMap] = await Promise.all([
    getT(),
    getLocale(),
    getUserMonitorsCached(user.id),
    getIncidentUpdates([incident.id]),
    getIncidentMonitorIds([incident.id]),
  ]);
  const lc = locale.code;
  const updates = updatesMap.get(incident.id) ?? [];
  const affectedIds = new Set([...(monitorMap.get(incident.id) ?? []), ...(incident.monitor_id ? [incident.monitor_id] : [])]);
  const affected = monitors.filter((m) => affectedIds.has(m.id));
  const open = !RESOLVED_STATUSES.includes(incident.status);
  const cause = incident.cause ? (parseJson(incident.cause) as Record<string, unknown>) : null;
  const causeError = cause && typeof cause.error === "string" ? cause.error : null;
  const causeCode = cause && typeof cause.statusCode === "number" ? cause.statusCode : null;
  const causeMs = cause && typeof cause.responseMs === "number" ? cause.responseMs : null;

  return (
    <>
      {query.created === "1" ? (
        <>
          <RefreshOnce cleanUrl={`/dashboard/incidents/${incident.id}`} />
          <Alert tone="success" className="mb-6">
            {t("dash.incident.created")}
          </Alert>
        </>
      ) : null}
      <Link href="/dashboard/incidents" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("dash.nav.incidents")}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">{incident.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <IncidentStatusBadge status={incident.status} label={t(`dash.istatus.${incident.status}` as MessageKey)} />
            <ImpactBadge impact={incident.impact} label={t(`dash.impact.${incident.impact}` as MessageKey)} />
            <Badge>{incident.kind === "auto" ? t("dash.incidents.auto") : t("dash.incidents.manual")}</Badge>
          </div>
        </div>
        <ActionButton
          action={deleteIncidentAction}
          fields={{ incident_id: incident.id }}
          confirmText={t("dash.incident.deleteConfirm")}
          buttonClassName="hover:border-red-300 hover:text-red-600"
        >
          <Trash aria-hidden />
          {t("dash.incident.delete")}
        </ActionButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {open ? (
            <Panel title={t("dash.incident.postUpdate")} description={t("dash.incident.postUpdateText")}>
              <IncidentUpdateForm incidentId={incident.id} kind={incident.kind} current={incident.status} />
            </Panel>
          ) : null}

          <Panel title={t("dash.incident.timeline")}>
            {updates.length ? (
              <ol className="relative space-y-6 border-s border-line ps-6">
                {updates.map((u) => (
                  <li key={u.id} className="relative">
                    <span className={cn("absolute -start-[31px] top-1 size-3 rounded-full ring-4 ring-surface", TIMELINE_DOT[u.status] ?? "bg-gray-400")} aria-hidden />
                    <div className="flex flex-wrap items-center gap-2">
                      <IncidentStatusBadge status={u.status} label={t(`dash.istatus.${u.status}` as MessageKey)} />
                      <time dateTime={u.created_at} className="text-xs text-muted" title={formatDateTime(u.created_at, lc)}>
                        {formatDateTime(u.created_at, lc)} · {formatRelative(u.created_at, lc)}
                      </time>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-line">{u.message}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">{incident.kind === "auto" ? t("dash.incident.autoNoUpdates") : t("dash.incident.noUpdates")}</p>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title={t("dash.incident.details")}>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted">{t("dash.incident.startedAt")}</dt>
                <dd className="mt-0.5 font-medium">{formatDateTime(incident.started_at, lc)}</dd>
              </div>
              <div>
                <dt className="text-muted">{incident.resolved_at ? t("dash.incident.resolvedAt") : t("dash.incident.duration")}</dt>
                <dd className="mt-0.5 font-medium">
                  {incident.resolved_at
                    ? `${formatDateTime(incident.resolved_at, lc)} (${formatDuration((Date.parse(incident.resolved_at) - Date.parse(incident.started_at)) / 1000, t)})`
                    : t("dash.incident.ongoing", { time: formatRelative(incident.started_at, lc) })}
                </dd>
              </div>
              {causeError || causeCode !== null ? (
                <div>
                  <dt className="text-muted">{t("dash.incident.cause")}</dt>
                  <dd className="mt-1 rounded-lg bg-red-50 px-3 py-2 text-red-900 dark:bg-red-950/40 dark:text-red-200">
                    {causeError ? <p className="break-words">{causeError}</p> : null}
                    {causeCode !== null || causeMs !== null ? (
                      <p className="mt-0.5 text-xs opacity-80">
                        {[causeCode !== null ? `HTTP ${causeCode}` : null, causeMs !== null ? formatMs(causeMs, lc) : null].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Panel>
          <Panel title={t("dash.incident.affected")} padded={false}>
            {affected.length ? (
              <ul className="divide-y divide-line">
                {affected.map((m) => (
                  <li key={m.id}>
                    <Link href={`/dashboard/monitors/${m.id}`} className="flex items-center gap-2.5 px-5 py-2.5 text-sm hover:bg-paper">
                      <StatusDot status={effectiveStatus(m)} size="sm" />
                      <span className="truncate">{m.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">{t("dash.incident.noAffected")}</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
