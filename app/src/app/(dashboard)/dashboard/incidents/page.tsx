import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Plus, Siren } from "lucide-react";
import { RefreshOnce } from "@/components/dashboard/actions";
import { ImpactBadge, IncidentStatusBadge } from "@/components/dashboard/monitor-meta";
import { DashHeader, Empty, LinkTabs, Panel } from "@/components/dashboard/ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireDashboardUser } from "@/lib/dashboard";
import { formatDateTime, formatRelative } from "@/lib/dash-format";
import { getUserIncidents, getUserMonitorsCached } from "@/lib/dashboard-data";
import { getLocale, getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { getIncidentMonitorIds, getIncidentUpdates, RESOLVED_STATUSES } from "@/lib/incidents";
import { formatDuration } from "@/monitor/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.nav.incidents") };
}

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ tab?: string; deleted?: string }> }) {
  const user = await requireDashboardUser();
  const [query, t, locale, monitors] = await Promise.all([searchParams, getT(), getLocale(), getUserMonitorsCached(user.id)]);
  const tab = query.tab === "resolved" ? "resolved" : "open";
  const all = await getUserIncidents(user.id, { kinds: ["auto", "manual"], limit: 300 });
  const open = all.filter((i) => !RESOLVED_STATUSES.includes(i.status));
  const resolved = all.filter((i) => RESOLVED_STATUSES.includes(i.status));
  const list = (tab === "open" ? open : resolved).slice(0, 100);
  const [monitorIds, updates] = await Promise.all([getIncidentMonitorIds(list.map((i) => i.id)), getIncidentUpdates(list.map((i) => i.id))]);
  const names = new Map(monitors.map((m) => [m.id, m.name]));
  const lc = locale.code;

  return (
    <>
      {query.deleted === "1" ? (
        <>
          <RefreshOnce cleanUrl="/dashboard/incidents" />
          <Alert tone="success" className="mb-6">
            {t("dash.incident.deleted")}
          </Alert>
        </>
      ) : null}
      <DashHeader
        title={t("dash.nav.incidents")}
        description={t("dash.incidents.subtitle")}
        actions={
          <ButtonLink href="/dashboard/incidents/new">
            <Plus aria-hidden />
            {t("dash.incidents.report")}
          </ButtonLink>
        }
      />
      <div className="mb-4">
        <LinkTabs
          label={t("dash.incidents.tabs")}
          items={[
            { href: "/dashboard/incidents", label: t("dash.incidents.open"), active: tab === "open", count: open.length },
            { href: "/dashboard/incidents?tab=resolved", label: t("dash.incidents.resolved"), active: tab === "resolved", count: resolved.length },
          ]}
        />
      </div>
      <Panel padded={false}>
        {list.length ? (
          <ul className="divide-y divide-line">
            {list.map((i) => {
              const latest = updates.get(i.id)?.[0];
              const affected = (monitorIds.get(i.id) ?? []).map((id) => names.get(id)).filter(Boolean);
              return (
                <li key={i.id}>
                  <Link href={`/dashboard/incidents/${i.id}`} className="block px-5 py-4 transition-colors hover:bg-paper">
                    <div className="flex flex-wrap items-center gap-2">
                      <p dir="auto" className="min-w-0 flex-1 truncate font-medium">{i.title}</p>
                      <IncidentStatusBadge status={i.status} label={t(`dash.istatus.${i.status}` as MessageKey)} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <ImpactBadge impact={i.impact} label={t(`dash.impact.${i.impact}` as MessageKey)} />
                      <Badge>{i.kind === "auto" ? t("dash.incidents.auto") : t("dash.incidents.manual")}</Badge>
                      <span title={formatDateTime(i.started_at, lc)}>{t("dash.incidents.started", { time: formatRelative(i.started_at, lc) })}</span>
                      {i.resolved_at ? <span>· {t("dash.incidents.lasted", { time: formatDuration((Date.parse(i.resolved_at) - Date.parse(i.started_at)) / 1000, t) })}</span> : null}
                      {affected.length ? <span className="truncate">· {affected.join(", ")}</span> : null}
                    </div>
                    {latest ? <p dir="auto" className="mt-2 line-clamp-2 text-sm text-muted">{latest.message}</p> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : tab === "open" ? (
          <Empty icon={<CircleCheck />} title={t("dash.incidents.noneOpen")}>
            {t("dash.incidents.noneOpenText")}
          </Empty>
        ) : (
          <Empty icon={<Siren />} title={t("dash.incidents.noneResolved")} />
        )}
      </Panel>
    </>
  );
}
