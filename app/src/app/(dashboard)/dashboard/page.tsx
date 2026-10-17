import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, BellRing, CircleCheck, Crown, PanelsTopLeft, Plus, Siren, TriangleAlert } from "lucide-react";
import { MonitorRows } from "@/components/dashboard/monitor-list";
import { IncidentStatusBadge } from "@/components/dashboard/monitor-meta";
import { Meter, Panel } from "@/components/dashboard/ui";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireDashboardUser } from "@/lib/dashboard";
import { formatNumber, formatRelative } from "@/lib/dash-format";
import { getUserIncidents, getUserMonitorsCached } from "@/lib/dashboard-data";
import { buildMonitorItems, effectiveStatus } from "@/lib/dashboard-view";
import { getUserChannels } from "@/lib/channels";
import { getLocale, getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { atLimit, getEntitlements } from "@/lib/plans";
import { countUserStatusPages } from "@/lib/status-pages";
import { cn } from "@/lib/utils";
import { formatInterval } from "@/monitor/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.overview.title") };
}

export default async function DashboardPage() {
  const user = await requireDashboardUser();
  const [t, locale, entitlements, monitors, pageCount, channels, openIncidents] = await Promise.all([
    getT(),
    getLocale(),
    getEntitlements(user),
    getUserMonitorsCached(user.id),
    countUserStatusPages(user.id),
    getUserChannels(user.id),
    getUserIncidents(user.id, { kinds: ["auto", "manual"], open: true, limit: 5 }),
  ]);
  const lc = locale.code;
  const firstName = user.name.split(/\s+/)[0] || user.name;

  if (!monitors.length) {
    const steps = [
      { icon: Activity, title: t("dash.onboard.step1Title"), text: t("dash.onboard.step1Text"), href: "/dashboard/monitors/new", cta: t("dash.onboard.step1Cta"), done: false },
      { icon: BellRing, title: t("dash.onboard.step2Title"), text: t("dash.onboard.step2Text"), href: "/dashboard/channels/new", cta: t("dash.onboard.step2Cta"), done: channels.length > 0 },
      { icon: PanelsTopLeft, title: t("dash.onboard.step3Title"), text: t("dash.onboard.step3Text"), href: "/dashboard/status-pages", cta: t("dash.onboard.step3Cta"), done: pageCount > 0 },
    ];
    return (
      <>
        <section className="mat-grid relative overflow-hidden rounded-2xl border border-line px-6 py-12 text-center sm:px-12 sm:py-16">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-white shadow-lg">
            <Activity className="size-7" aria-hidden />
          </span>
          <h1 className="mt-6 text-3xl font-bold sm:text-4xl">{t("dash.onboard.title", { name: firstName })}</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">{t("dash.onboard.text")}</p>
          <ButtonLink href="/dashboard/monitors/new" size="lg" className="mt-8">
            <Plus aria-hidden />
            {t("dash.onboard.cta")}
          </ButtonLink>
        </section>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-full font-display font-bold",
                    step.done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-primary-soft text-primary",
                  )}
                >
                  {step.done ? <CircleCheck className="size-5" aria-label={t("dash.onboard.done")} /> : i + 1}
                </span>
                <step.icon className="size-5 text-muted" aria-hidden />
              </div>
              <h2 className="mt-4 font-sans text-base font-semibold tracking-normal">{step.title}</h2>
              <p className="mt-1 flex-1 text-sm text-muted">{step.text}</p>
              <Link href={step.href} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                {step.cta}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      </>
    );
  }

  const items = await buildMonitorItems(monitors, t, lc);
  const statuses = monitors.map(effectiveStatus);
  const down = statuses.filter((s) => s === "down").length;
  const up = statuses.filter((s) => s === "up").length;
  const paused = statuses.filter((s) => s === "paused").length;
  const pending = statuses.filter((s) => s === "pending" || s === "maintenance").length;
  const sorted = [...items].sort((a, b) => Number(b.status === "down") - Number(a.status === "down"));
  const num = (n: number) => formatNumber(n, lc);
  const limitText = (n: number) => (n > 0 ? num(n) : t("pricing.unlimited"));
  const atAnyLimit = atLimit(monitors.length, entitlements.maxMonitors) || atLimit(pageCount, entitlements.maxStatusPages);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("dash.overview.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("dash.overview.subtitle", { name: firstName })}</p>
        </div>
        <ButtonLink href="/dashboard/monitors/new">
          <Plus aria-hidden />
          {t("dash.monitors.add")}
        </ButtonLink>
      </div>

      <section
        aria-labelledby="dash-summary"
        className={cn(
          "relative overflow-hidden rounded-2xl border p-6 sm:p-8",
          down
            ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
            : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
        )}
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-8">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-2xl text-white shadow-sm sm:size-14",
                down ? "bg-red-600" : "bg-emerald-600",
              )}
            >
              {down ? <TriangleAlert className="size-7" aria-hidden /> : <CircleCheck className="size-7" aria-hidden />}
            </span>
            <div className="min-w-0">
              <h2 id="dash-summary" className={cn("text-xl font-bold sm:text-2xl", down ? "text-red-900 dark:text-red-100" : "text-emerald-900 dark:text-emerald-100")}>
                {down ? t("dash.overview.downTitle", { n: down }) : up ? t("dash.overview.allUp") : t("dash.overview.waiting")}
              </h2>
              <p className={cn("mt-0.5 text-sm", down ? "text-red-800/80 dark:text-red-200/80" : "text-emerald-800/80 dark:text-emerald-200/80")}>
                {down ? t("dash.overview.downText") : t("dash.overview.allUpText", { n: up })}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-6 sm:gap-10">
            {[
              { label: t("dash.status.up"), value: up, cls: "text-emerald-700 dark:text-emerald-400" },
              { label: t("dash.status.down"), value: down, cls: down ? "text-red-700 dark:text-red-400" : "text-ink" },
              { label: t("dash.status.paused"), value: paused, cls: "text-muted" },
            ].map((s) => (
              <div key={s.label}>
                <dt className="text-xs font-medium text-muted">{s.label}</dt>
                <dd className={cn("font-display text-3xl font-bold tabular-nums", s.cls)}>{num(s.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
        {pending ? <p className="mt-4 text-xs text-muted">{t("dash.overview.pending", { n: pending })}</p> : null}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel
          title={t("dash.nav.monitors")}
          padded={false}
          className="self-start"
          actions={
            <Link href="/dashboard/monitors" className="text-sm font-medium text-primary hover:underline">
              {t("dash.overview.viewAll")}
            </Link>
          }
        >
          <MonitorRows items={sorted.slice(0, 12)} compact />
          {sorted.length > 12 ? (
            <div className="border-t border-line px-5 py-3 text-center">
              <Link href="/dashboard/monitors" className="text-sm font-medium text-primary hover:underline">
                {t("dash.overview.more", { n: sorted.length - 12 })}
              </Link>
            </div>
          ) : null}
        </Panel>

        <div className="space-y-6">
          <Panel
            title={t("dash.overview.openIncidents")}
            actions={
              <Link href="/dashboard/incidents/new" className="text-sm font-medium text-primary hover:underline">
                {t("dash.incidents.report")}
              </Link>
            }
          >
            {openIncidents.length ? (
              <ul className="-my-2 divide-y divide-line">
                {openIncidents.map((i) => (
                  <li key={i.id} className="py-2.5">
                    <Link href={`/dashboard/incidents/${i.id}`} className="block rounded-md hover:text-primary">
                      <p className="line-clamp-2 text-sm font-medium">{i.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <IncidentStatusBadge status={i.status} label={t(`dash.istatus.${i.status}` as MessageKey)} />
                        {formatRelative(i.started_at, lc)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Siren className="size-4 shrink-0" aria-hidden />
                {t("dash.overview.noIncidents")}
              </p>
            )}
          </Panel>

          <Panel
            title={t("dash.usage.title")}
            description={entitlements.plan?.name ?? (user.role === "admin" ? t("dash.usage.adminPlan") : t("account.free"))}
            actions={entitlements.isPremium ? <Badge tone="success">{t("account.active")}</Badge> : null}
          >
            <div className="space-y-5">
              <Meter label={t("dash.usage.monitors")} used={monitors.length} limit={entitlements.maxMonitors} usedText={num(monitors.length)} limitText={limitText(entitlements.maxMonitors)} />
              <Meter label={t("dash.usage.statusPages")} used={pageCount} limit={entitlements.maxStatusPages} usedText={num(pageCount)} limitText={limitText(entitlements.maxStatusPages)} />
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{t("dash.usage.interval")}</span>
                <span className="font-medium tabular-nums">{formatInterval(entitlements.minIntervalSec, t)}</span>
              </div>
            </div>
            {!entitlements.isPremium || atAnyLimit ? (
              <div className="mt-5 rounded-lg bg-primary-soft p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Crown className="size-4 text-amber-500" aria-hidden />
                  {atAnyLimit ? t("dash.usage.limitReached") : t("dash.usage.upgradeTitle")}
                </p>
                <p className="mt-1 text-xs text-muted">{t("dash.usage.upgradeText")}</p>
                <ButtonLink href="/pricing" size="sm" className="mt-3 w-full">
                  {t("dash.usage.upgradeCta")}
                </ButtonLink>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </>
  );
}
