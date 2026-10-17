import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BellOff, CalendarClock, Copy, ExternalLink, LockKeyhole, Pause, Pencil, Play, RefreshCw, Siren, Trash } from "lucide-react";
import { ActionButton, RefreshOnce } from "@/components/dashboard/actions";
import { ResponseChart, UptimeBars, UptimeLegend } from "@/components/dashboard/charts";
import { HeartbeatSnippets } from "@/components/dashboard/heartbeat-snippets";
import { ChannelIcon, IncidentStatusBadge, StatusDot, TypeBadge, statusTextClass } from "@/components/dashboard/monitor-meta";
import { DTable, DTd, DTh, Empty, LinkTabs, Pager, Panel } from "@/components/dashboard/ui";
import { checkNowAction, deleteMonitorAction, duplicateMonitorAction, toggleMonitorAction } from "@/app/actions/dashboard/monitors";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { getMonitorChannels } from "@/lib/channels";
import { requireDashboardUser } from "@/lib/dashboard";
import { daysUntil, formatDateTime, formatDay, formatMs, formatNumber, formatPercent, formatRelative, formatTime, intParam, uptimeBand } from "@/lib/dash-format";
import { countMonitorChecks, getChecksPage, getMonitorAlertLog, getMonitorIncidents, getResponseBuckets, getRollingUptime } from "@/lib/dashboard-data";
import { effectiveStatus } from "@/lib/dashboard-view";
import { getLocale, getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { getOwnedMonitor } from "@/lib/monitors";
import { baseUrl } from "@/lib/request";
import { getUptimeDays, getUptimePercent } from "@/lib/uptime";
import { cn } from "@/lib/utils";
import { formatDuration, formatInterval } from "@/monitor/format";
import { ALERT_EVENTS } from "@/monitor/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await requireDashboardUser();
  const monitor = await getOwnedMonitor(Number((await params).id), user.id);
  return { title: monitor?.name ?? "" };
}

const PER_PAGE = 25;

const BAND_TEXT = {
  none: "text-muted",
  good: "text-emerald-700 dark:text-emerald-400",
  ok: "text-lime-700 dark:text-lime-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-red-700 dark:text-red-400",
} as const;

export default async function MonitorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; page?: string; created?: string; saved?: string }>;
}) {
  const user = await requireDashboardUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const monitor = await getOwnedMonitor(Number(id), user.id);
  if (!monitor) notFound();

  const range = query.range === "7d" ? "7d" : "24h";
  const total = await countMonitorChecks(monitor.id);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(intParam(query.page, 1), pages);
  const [t, locale, rolling, longUptime, days, series, checks, incidents, alerts, channels, base] = await Promise.all([
    getT(),
    getLocale(),
    getRollingUptime([monitor.id], 24),
    Promise.all([7, 30, 90].map((d) => getUptimePercent([monitor.id], d).then((m) => m.get(monitor.id) ?? null))),
    getUptimeDays([monitor.id], 90),
    range === "7d" ? getResponseBuckets(monitor.id, 168, 84) : getResponseBuckets(monitor.id, 24, 48),
    getChecksPage(monitor.id, page, PER_PAGE),
    getMonitorIncidents(monitor.id, 10),
    getMonitorAlertLog(monitor.id, 20),
    getMonitorChannels(monitor.id),
    baseUrl(),
  ]);
  const lc = locale.code;
  const status = effectiveStatus(monitor);
  const isHeartbeat = monitor.type === "heartbeat";
  const pingUrl = `${base}/api/ping/${monitor.heartbeatToken}`;
  const href = (p: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const next = { range: range === "7d" ? "7d" : undefined, page: page > 1 ? page : undefined, ...p };
    for (const [k, v] of Object.entries(next)) if (v !== undefined && v !== "") sp.set(k, String(v));
    const s = sp.toString();
    return `/dashboard/monitors/${monitor.id}${s ? `?${s}` : ""}`;
  };

  const uptimeStats = [
    { label: t("dash.detail.uptime24h"), value: rolling.get(monitor.id) ?? null },
    { label: t("dash.detail.uptime7d"), value: longUptime[0] },
    { label: t("dash.detail.uptime30d"), value: longUptime[1] },
    { label: t("dash.detail.uptime90d"), value: longUptime[2] },
  ];
  const okValues = series.map((s) => s.avgMs).filter((v): v is number => v !== null);
  const avg = okValues.length ? Math.round(okValues.reduce((a, b) => a + b, 0) / okValues.length) : null;
  const minMs = series.reduce<number | null>((m, s) => (s.minMs !== null && (m === null || s.minMs < m) ? s.minMs : m), null);
  const maxMs = series.reduce<number | null>((m, s) => (s.maxMs !== null && (m === null || s.maxMs > m) ? s.maxMs : m), null);
  const withDay = range === "7d";

  const expiries = [
    monitor.sslExpiresAt || monitor.type === "ssl" ? { icon: LockKeyhole, label: t("dash.detail.sslExpiry"), at: monitor.sslExpiresAt } : null,
    monitor.domainExpiresAt || monitor.type === "domain" ? { icon: CalendarClock, label: t("dash.detail.domainExpiry"), at: monitor.domainExpiresAt } : null,
  ].filter((e) => e !== null);
  const warnDays = "warnDays" in monitor.config ? Number(monitor.config.warnDays) : 14;

  return (
    <>
      {query.created === "1" || query.saved === "1" ? (
        <>
          <RefreshOnce cleanUrl={`/dashboard/monitors/${monitor.id}`} />
          <Alert tone="success" className="mb-6">
            {query.created === "1" ? (isHeartbeat ? t("dash.monitor.createdHeartbeat") : t("dash.monitor.created")) : t("dash.monitor.saved")}
          </Alert>
        </>
      ) : null}

      <Link href="/dashboard/monitors" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("dash.nav.monitors")}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold">{monitor.name}</h1>
            <TypeBadge type={monitor.type} label={t(`dash.type.${monitor.type}` as MessageKey)} />
          </div>
          <p className="mt-1 truncate text-sm text-muted" dir="ltr">
            {monitor.type === "http" || monitor.type === "keyword" ? (
              <a href={monitor.target} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:text-primary">
                {monitor.target}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : isHeartbeat ? (
              t("dash.monitor.heartbeatTarget")
            ) : (
              monitor.target
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {monitor.isActive && !isHeartbeat && monitor.type !== "domain" ? (
            <ActionButton action={checkNowAction} fields={{ monitor_id: monitor.id }} showSuccess>
              <RefreshCw aria-hidden />
              {t("dash.monitor.checkNow")}
            </ActionButton>
          ) : null}
          <ActionButton action={toggleMonitorAction} fields={{ monitor_id: monitor.id, active: monitor.isActive ? "0" : "1" }}>
            {monitor.isActive ? <Pause aria-hidden /> : <Play aria-hidden />}
            {monitor.isActive ? t("dash.monitor.pause") : t("dash.monitor.resume")}
          </ActionButton>
          <ButtonLink href={`/dashboard/monitors/${monitor.id}/edit`} variant="outline" size="sm">
            <Pencil aria-hidden />
            {t("dash.monitor.edit")}
          </ButtonLink>
          <ActionButton action={duplicateMonitorAction} fields={{ monitor_id: monitor.id }} label={t("dash.monitor.duplicate")}>
            <Copy aria-hidden />
            <span className="max-sm:hidden">{t("dash.monitor.duplicate")}</span>
          </ActionButton>
          <ActionButton
            action={deleteMonitorAction}
            fields={{ monitor_id: monitor.id }}
            confirmText={t("dash.monitor.deleteConfirm", { name: monitor.name })}
            label={t("dash.monitor.delete")}
            buttonClassName="hover:border-red-300 hover:text-red-600"
          >
            <Trash aria-hidden />
          </ActionButton>
        </div>
      </div>

      {/* Current status */}
      <section aria-label={t("dash.detail.current")} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-10 gap-y-5">
          <div className="flex items-center gap-4">
            <StatusDot status={status} size="lg" />
            <div>
              <p className={cn("font-display text-3xl font-bold", statusTextClass(status))}>{t(`dash.status.${status}` as MessageKey)}</p>
              <p className="text-sm text-muted">
                {monitor.lastChangeAt ? t("dash.detail.since", { time: formatRelative(monitor.lastChangeAt, lc) }) : null}
              </p>
            </div>
          </div>
          <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">{isHeartbeat ? t("dash.detail.lastPing") : t("dash.detail.lastCheck")}</dt>
              <dd className="mt-0.5 font-medium">
                {isHeartbeat
                  ? monitor.lastPingAt
                    ? formatRelative(monitor.lastPingAt, lc)
                    : t("dash.monitor.noPing")
                  : monitor.lastCheckAt
                    ? formatRelative(monitor.lastCheckAt, lc)
                    : t("dash.monitor.notYet")}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{isHeartbeat ? t("dash.form.expectEvery") : t("dash.form.interval")}</dt>
              <dd className="mt-0.5 font-medium">{formatInterval(monitor.intervalSec, t)}</dd>
            </div>
            <div>
              <dt className="text-muted">{isHeartbeat ? t("dash.detail.runtime") : t("dash.detail.lastResponse")}</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{formatMs(monitor.lastResponseMs, lc)}</dd>
            </div>
          </dl>
        </div>
        {status === "down" && monitor.lastError ? (
          <Alert tone="error" className="mt-5" title={t("dash.detail.lastError")}>
            <span className="break-words">{monitor.lastError}</span>
          </Alert>
        ) : null}
        {!monitor.isActive ? (
          <Alert tone="info" className="mt-5">
            {t("dash.detail.pausedNotice")}
          </Alert>
        ) : null}
      </section>

      {isHeartbeat ? (
        <Panel title={t("dash.heartbeat.title")} description={t("dash.heartbeat.text")} className="mt-6">
          <HeartbeatSnippets url={pingUrl} />
        </Panel>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {uptimeStats.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className={cn("mt-1.5 font-display text-2xl font-bold tabular-nums sm:text-3xl", BAND_TEXT[uptimeBand(s.value)])}>{formatPercent(s.value, lc, 3)}</p>
          </div>
        ))}
      </div>

      {expiries.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {expiries.map((e) => {
            const left = daysUntil(e.at);
            const tone = left === null ? "text-muted" : left < 0 || left <= Math.min(7, warnDays) ? "text-red-700 dark:text-red-400" : left <= warnDays ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400";
            return (
              <div key={e.label} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <e.icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-muted">{e.label}</p>
                  <p className={cn("font-display text-xl font-bold", tone)}>
                    {left === null ? t("dash.detail.expiryUnknown") : left < 0 ? t("dash.detail.expired") : t("dash.detail.daysLeft", { n: left })}
                  </p>
                  {e.at ? <p className="text-xs text-muted">{formatDateTime(e.at, lc, false)}</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!isHeartbeat || okValues.length ? (
        <Panel
          title={isHeartbeat ? t("dash.detail.runtimeChart") : t("dash.detail.responseChart")}
          description={
            avg !== null
              ? t("dash.detail.responseSummary", { avg: formatMs(avg, lc), min: formatMs(minMs, lc), max: formatMs(maxMs, lc) })
              : undefined
          }
          className="mt-6"
          actions={
            <LinkTabs
              label={t("dash.detail.range")}
              items={[
                { href: href({ range: undefined, page: undefined }), label: t("dash.detail.range24h"), active: range === "24h" },
                { href: href({ range: "7d", page: undefined }), label: t("dash.detail.range7d"), active: range === "7d" },
              ]}
            />
          }
        >
          <ResponseChart
            label={t("dash.detail.responseChart")}
            emptyText={t("dash.detail.noData")}
            axis={{
              start: range === "7d" ? t("dash.detail.daysAgo", { n: 7 }) : t("dash.detail.hoursAgo", { n: 24 }),
              middle: formatTime(series[Math.floor(series.length / 2)].at, lc, withDay),
              end: t("dash.detail.now"),
              unit: (n) => formatMs(n, lc),
            }}
            data={series.map((s) => ({
              ...s,
              tip: {
                title: formatTime(s.at, lc, true),
                lines: [
                  s.avgMs !== null ? t("dash.detail.tipAvg", { time: formatMs(s.avgMs, lc) }) : t("dash.detail.tipNoOk"),
                  ...(s.minMs !== null && s.maxMs !== null && s.minMs !== s.maxMs ? [t("dash.detail.tipRange", { min: formatMs(s.minMs, lc), max: formatMs(s.maxMs, lc) })] : []),
                  ...(s.failures ? [t("dash.detail.tipFailures", { n: s.failures, total: s.checks })] : []),
                ],
              },
            }))}
          />
        </Panel>
      ) : null}

      <Panel title={t("dash.detail.history")} description={t("dash.detail.historyText")} className="mt-6" actions={<UptimeLegend labels={{ good: "≥ 99.9%", ok: "≥ 99%", warn: "≥ 95%", bad: "< 95%", none: t("dash.detail.noData") }} />}>
        <UptimeBars
          label={t("dash.detail.history")}
          startLabel={t("dash.detail.daysAgo", { n: 90 })}
          endLabel={t("dash.detail.today")}
          days={days.map((d) => ({
            day: d.day,
            uptime: d.uptime,
            tip: {
              title: formatDay(d.day, lc, true),
              lines:
                d.uptime === null
                  ? [t("dash.detail.noData")]
                  : [
                      t("dash.detail.tipUptime", { uptime: formatPercent(d.uptime, lc) }),
                      ...(d.downtimeSec > 0 ? [t("dash.detail.tipDowntime", { time: formatDuration(d.downtimeSec, t) })] : []),
                      ...(d.incidents > 0 ? [t("dash.detail.tipIncidents", { n: d.incidents })] : []),
                    ],
            },
          }))}
        />
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title={t("dash.detail.incidents")} padded={false}>
          {incidents.length ? (
            <ul className="divide-y divide-line">
              {incidents.map((i) => (
                <li key={i.id}>
                  <Link href={i.kind === "maintenance" ? `/dashboard/maintenance/${i.id}` : `/dashboard/incidents/${i.id}`} className="block px-5 py-3 hover:bg-paper">
                    <p className="truncate text-sm font-medium">{i.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <IncidentStatusBadge status={i.status} label={t(`dash.istatus.${i.status}` as MessageKey)} />
                      <span>{formatDateTime(i.started_at, lc)}</span>
                      {i.resolved_at ? <span>· {t("dash.incidents.lasted", { time: formatDuration((Date.parse(i.resolved_at) - Date.parse(i.started_at)) / 1000, t) })}</span> : null}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={<Siren />} title={t("dash.detail.noIncidents")} />
          )}
        </Panel>

        <Panel
          title={t("dash.detail.alertLog")}
          description={channels.length ? t("dash.detail.alertsTo", { channels: channels.map((c) => c.name).join(", ") }) : undefined}
          padded={false}
        >
          {alerts.length ? (
            <ul className="divide-y divide-line">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                  {a.channel_type ? <ChannelIcon type={a.channel_type} className="mt-0.5 text-muted" /> : <BellOff className="mt-0.5 size-4 text-muted" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{(ALERT_EVENTS as readonly string[]).includes(a.event) ? t(`dash.event.${a.event}` as MessageKey) : a.event}</span>
                      <span className="text-muted"> · {a.channel_name ?? t("dash.detail.deletedChannel")}</span>
                    </p>
                    {!a.ok && a.error ? <p className="mt-0.5 text-xs break-words text-red-600 dark:text-red-400">{a.error}</p> : null}
                  </div>
                  <div className="shrink-0 text-end">
                    <p className={cn("text-xs font-medium", a.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                      {a.ok ? t("dash.detail.sent") : t("dash.detail.failed")}
                    </p>
                    <p className="text-xs text-muted">{formatRelative(a.created_at, lc)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={<BellOff />} title={t("dash.detail.noAlerts")}>
              {channels.length ? null : (
                <Link href={`/dashboard/monitors/${monitor.id}/edit`} className="font-medium text-primary hover:underline">
                  {t("dash.detail.addChannels")}
                </Link>
              )}
            </Empty>
          )}
        </Panel>
      </div>

      <Panel title={isHeartbeat ? t("dash.detail.pings") : t("dash.detail.checks")} description={t("dash.detail.checksTotal", { n: formatNumber(total, lc) })} padded={false} className="mt-6" id="checks">
        {checks.length ? (
          <>
            <DTable label={t("dash.detail.checks")} minWidth={600}>
              <thead>
                <tr>
                  <DTh>{t("dash.detail.colTime")}</DTh>
                  <DTh>{t("dash.detail.colResult")}</DTh>
                  <DTh>{t("dash.detail.colCode")}</DTh>
                  <DTh className="text-end">{t("dash.detail.colResponse")}</DTh>
                  <DTh>{t("dash.detail.colError")}</DTh>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.id}>
                    <DTd className="whitespace-nowrap text-muted">{formatDateTime(c.checked_at, lc)}</DTd>
                    <DTd>
                      <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", c.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                        <span className={cn("size-1.5 rounded-full", c.ok ? "bg-emerald-500" : "bg-red-500")} aria-hidden />
                        {c.ok ? t("dash.status.up") : t("dash.status.down")}
                      </span>
                    </DTd>
                    <DTd className="tabular-nums">{c.status_code ?? "—"}</DTd>
                    <DTd className="text-end tabular-nums">{formatMs(c.response_ms, lc)}</DTd>
                    <DTd className="max-w-72 truncate text-muted">
                      <span title={c.error ?? undefined}>{c.error ?? "—"}</span>
                    </DTd>
                  </tr>
                ))}
              </tbody>
            </DTable>
            <Pager
              page={page}
              pages={pages}
              href={(p) => `${href({ page: p > 1 ? p : undefined })}#checks`}
              labels={{ summary: t("dash.pager.summary", { page, pages }), previous: t("dash.pager.previous"), next: t("dash.pager.next"), nav: t("dash.pager.nav") }}
            />
          </>
        ) : (
          <Empty title={isHeartbeat ? t("dash.detail.noPings") : t("dash.detail.noChecks")}>{isHeartbeat ? t("dash.detail.noPingsText") : t("dash.detail.noChecksText")}</Empty>
        )}
      </Panel>
    </>
  );
}
