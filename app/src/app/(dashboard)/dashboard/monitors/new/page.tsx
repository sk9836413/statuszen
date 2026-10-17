import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Crown } from "lucide-react";
import { MonitorForm } from "@/components/dashboard/monitor-form";
import { TYPE_ICONS } from "@/components/dashboard/monitor-meta";
import { DashHeader, Panel } from "@/components/dashboard/ui";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { getUserChannels } from "@/lib/channels";
import { requireDashboardUser } from "@/lib/dashboard";
import { getLocale, getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { countUserMonitors } from "@/lib/monitors";
import { atLimit, getEntitlements } from "@/lib/plans";
import { defaultConfig, isMonitorType } from "@/monitor/normalize";
import { INTERVAL_CHOICES, MONITOR_TYPES, type MonitorType } from "@/monitor/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.newMonitor.title") };
}

const DEFAULT_INTERVAL: Record<MonitorType, number> = { http: 60, keyword: 60, tcp: 60, dns: 300, ssl: 3600, domain: 86400, heartbeat: 3600 };

export default async function NewMonitorPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const user = await requireDashboardUser();
  const [query, t, locale, entitlements, used, channels] = await Promise.all([
    searchParams,
    getT(),
    getLocale(),
    getEntitlements(user),
    countUserMonitors(user.id),
    getUserChannels(user.id),
  ]);

  if (atLimit(used, entitlements.maxMonitors)) {
    return (
      <>
        <DashHeader title={t("dash.newMonitor.title")} />
        <Panel>
          <div className="mx-auto max-w-md py-8 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-marker/30 text-amber-600">
              <Crown className="size-6" aria-hidden />
            </span>
            <p className="mt-4 font-semibold">{t("dash.err.monitorLimit", { limit: entitlements.maxMonitors })}</p>
            <p className="mt-1 text-sm text-muted">{t("dash.usage.upgradeText")}</p>
            <ButtonLink href="/pricing" className="mt-5">
              {t("dash.usage.upgradeCta")}
            </ButtonLink>
          </div>
        </Panel>
      </>
    );
  }

  const type = isMonitorType(query.type) ? query.type : null;
  if (!type) {
    return (
      <>
        <DashHeader title={t("dash.newMonitor.title")} description={t("dash.newMonitor.pick")} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MONITOR_TYPES.map((ty) => {
            const Icon = TYPE_ICONS[ty];
            return (
              <li key={ty}>
                <Link
                  href={`/dashboard/monitors/new?type=${ty}`}
                  className="group flex h-full gap-4 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-primary-line hover:bg-primary-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2 font-semibold">
                      {t(`dash.type.${ty}` as MessageKey)}
                      <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden />
                    </span>
                    <span className="mt-1 block text-sm text-muted">{t(`dash.typeDesc.${ty}` as MessageKey)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  const wanted = Math.max(DEFAULT_INTERVAL[type], entitlements.minIntervalSec);
  const intervalSec = INTERVAL_CHOICES.find((s) => s >= wanted) ?? INTERVAL_CHOICES[INTERVAL_CHOICES.length - 1];
  const Icon = TYPE_ICONS[type];

  return (
    <>
      <Link href="/dashboard/monitors/new" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("dash.newMonitor.changeType")}
      </Link>
      <DashHeader
        title={t("dash.newMonitor.titleType", { type: t(`dash.type.${type}` as MessageKey) })}
        description={
          <span className="inline-flex items-center gap-1.5">
            <Icon className="size-4" aria-hidden />
            {t(`dash.typeDesc.${type}` as MessageKey)}
          </span>
        }
      />
      {type === "heartbeat" ? (
        <Alert className="mb-6" title={t("dash.newMonitor.heartbeatTitle")}>
          {t("dash.newMonitor.heartbeatText")}
        </Alert>
      ) : null}
      <Panel>
        <MonitorForm
          values={{
            type,
            name: "",
            config: defaultConfig(type) as unknown as Record<string, unknown>,
            intervalSec,
            confirmCount: type === "heartbeat" ? 1 : 2,
            isActive: true,
            channelIds: channels.filter((c) => c.isActive).map((c) => c.id),
          }}
          channels={channels.map((c) => ({ id: c.id, name: c.name, type: c.type, isActive: c.isActive }))}
          minIntervalSec={entitlements.minIntervalSec}
          locale={locale.code}
        />
      </Panel>
    </>
  );
}
