import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CircleCheck, Pencil, Plus, Trash, X } from "lucide-react";
import { deleteIncidentAction, finishMaintenanceAction } from "@/app/actions/dashboard/incidents";
import { ActionButton, RefreshOnce } from "@/components/dashboard/actions";
import { LocalTime } from "@/components/dashboard/local-time";
import { DashHeader, Empty, Panel } from "@/components/dashboard/ui";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { requireDashboardUser } from "@/lib/dashboard";
import { maintenancePhase } from "@/lib/dash-format";
import { getUserIncidents, getUserMonitorsCached } from "@/lib/dashboard-data";
import { getLocale, getT } from "@/lib/i18n/server";
import { getIncidentMonitorIds } from "@/lib/incidents";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/monitor/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.nav.maintenance") };
}

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ created?: string; saved?: string; deleted?: string }> }) {
  const user = await requireDashboardUser();
  const [query, t, locale, monitors, windows] = await Promise.all([
    searchParams,
    getT(),
    getLocale(),
    getUserMonitorsCached(user.id),
    getUserIncidents(user.id, { kinds: ["maintenance"], limit: 200 }),
  ]);
  const monitorIds = await getIncidentMonitorIds(windows.map((w) => w.id));
  const names = new Map(monitors.map((m) => [m.id, m.name]));
  const lc = locale.code;

  const withPhase = windows.map((w) => ({ ...w, phase: maintenancePhase(w) }));
  const byStart = (a: { scheduled_start: string | null }, b: { scheduled_start: string | null }) => (a.scheduled_start ?? "").localeCompare(b.scheduled_start ?? "");
  const groups = [
    { key: "in_progress" as const, title: t("dash.maint.inProgress"), items: withPhase.filter((w) => w.phase === "in_progress").sort(byStart) },
    { key: "upcoming" as const, title: t("dash.maint.upcoming"), items: withPhase.filter((w) => w.phase === "upcoming").sort(byStart) },
    { key: "completed" as const, title: t("dash.maint.completed"), items: withPhase.filter((w) => w.phase === "completed").slice(0, 20) },
  ];
  const notice = query.created === "1" ? t("dash.maint.created") : query.saved === "1" ? t("dash.maint.saved") : query.deleted === "1" ? t("dash.maint.deleted") : "";

  return (
    <>
      {notice ? (
        <>
          <RefreshOnce cleanUrl="/dashboard/maintenance" />
          <Alert tone="success" className="mb-6">
            {notice}
          </Alert>
        </>
      ) : null}
      <DashHeader
        title={t("dash.nav.maintenance")}
        description={t("dash.maint.subtitle")}
        actions={
          <ButtonLink href="/dashboard/maintenance/new">
            <Plus aria-hidden />
            {t("dash.maint.schedule")}
          </ButtonLink>
        }
      />

      {windows.length ? (
        <div className="space-y-6">
          {groups.map((g) =>
            g.items.length || g.key !== "completed" ? (
              <Panel key={g.key} title={g.title} padded={false}>
                {g.items.length ? (
                  <ul className="divide-y divide-line">
                    {g.items.map((w) => {
                      const affected = (monitorIds.get(w.id) ?? []).map((id) => names.get(id)).filter(Boolean);
                      const start = w.scheduled_start ?? w.started_at;
                      const end = w.scheduled_end ?? w.started_at;
                      return (
                        <li key={w.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                          <span
                            className={cn(
                              "grid size-10 shrink-0 place-items-center rounded-xl",
                              g.key === "in_progress"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : g.key === "upcoming"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                  : "bg-line/60 text-muted",
                            )}
                            aria-hidden
                          >
                            {g.key === "completed" ? <CircleCheck className="size-5" /> : <CalendarClock className="size-5" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <Link href={`/dashboard/maintenance/${w.id}`} className="font-medium hover:text-primary">
                              {w.title}
                            </Link>
                            <p className="mt-0.5 text-sm text-muted">
                              <LocalTime iso={start} end={end} locale={lc} /> · {formatDuration((Date.parse(end) - Date.parse(start)) / 1000, t)}
                            </p>
                            {affected.length ? <p className="mt-0.5 truncate text-xs text-muted">{affected.join(", ")}</p> : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {g.key !== "completed" ? (
                              <ButtonLink href={`/dashboard/maintenance/${w.id}`} variant="outline" size="sm">
                                <Pencil aria-hidden />
                                {t("dash.monitor.edit")}
                              </ButtonLink>
                            ) : null}
                            {g.key === "in_progress" ? (
                              <ActionButton action={finishMaintenanceAction} fields={{ incident_id: w.id, op: "complete" }}>
                                <CircleCheck aria-hidden />
                                {t("dash.maint.complete")}
                              </ActionButton>
                            ) : null}
                            {g.key === "upcoming" ? (
                              <ActionButton action={finishMaintenanceAction} fields={{ incident_id: w.id, op: "cancel" }} confirmText={t("dash.maint.cancelConfirm")}>
                                <X aria-hidden />
                                {t("dash.maint.cancel")}
                              </ActionButton>
                            ) : null}
                            {g.key === "completed" ? (
                              <ActionButton
                                action={deleteIncidentAction}
                                fields={{ incident_id: w.id }}
                                confirmText={t("dash.maint.deleteConfirm")}
                                label={t("dash.incident.delete")}
                                buttonClassName="hover:border-red-300 hover:text-red-600"
                              >
                                <Trash aria-hidden />
                              </ActionButton>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-5 py-6 text-sm text-muted">{g.key === "in_progress" ? t("dash.maint.noneNow") : t("dash.maint.noneUpcoming")}</p>
                )}
              </Panel>
            ) : null,
          )}
        </div>
      ) : (
        <Panel>
          <Empty icon={<CalendarClock />} title={t("dash.maint.emptyTitle")} action={<ButtonLink href="/dashboard/maintenance/new">{t("dash.maint.schedule")}</ButtonLink>}>
            {t("dash.maint.emptyText")}
          </Empty>
        </Panel>
      )}
    </>
  );
}
