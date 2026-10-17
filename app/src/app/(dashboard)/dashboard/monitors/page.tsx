import type { Metadata } from "next";
import { Activity, Plus } from "lucide-react";
import { RefreshOnce } from "@/components/dashboard/actions";
import { MonitorList } from "@/components/dashboard/monitor-list";
import { DashHeader, Empty, Panel } from "@/components/dashboard/ui";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { requireDashboardUser } from "@/lib/dashboard";
import { getUserMonitorsCached } from "@/lib/dashboard-data";
import { buildMonitorItems } from "@/lib/dashboard-view";
import { getLocale, getT } from "@/lib/i18n/server";
import { atLimit, getEntitlements } from "@/lib/plans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.nav.monitors") };
}

export default async function MonitorsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = await requireDashboardUser();
  const [query, t, locale, entitlements, monitors] = await Promise.all([searchParams, getT(), getLocale(), getEntitlements(user), getUserMonitorsCached(user.id)]);
  const items = await buildMonitorItems(monitors, t, locale.code);
  const full = atLimit(monitors.length, entitlements.maxMonitors);

  return (
    <>
      {query.deleted === "1" ? (
        <>
          <RefreshOnce cleanUrl="/dashboard/monitors" />
          <Alert tone="success" className="mb-6">
            {t("dash.monitor.deleted")}
          </Alert>
        </>
      ) : null}
      <DashHeader
        title={t("dash.nav.monitors")}
        description={
          entitlements.maxMonitors > 0
            ? t("dash.monitors.subtitleLimit", { used: monitors.length, limit: entitlements.maxMonitors })
            : t("dash.monitors.subtitle")
        }
        actions={
          full ? (
            <ButtonLink href="/pricing" variant="outline">
              {t("dash.usage.upgradeCta")}
            </ButtonLink>
          ) : (
            <ButtonLink href="/dashboard/monitors/new">
              <Plus aria-hidden />
              {t("dash.monitors.add")}
            </ButtonLink>
          )
        }
      />
      {full ? (
        <Alert tone="warning" className="mb-6">
          {t("dash.err.monitorLimit", { limit: entitlements.maxMonitors })}
        </Alert>
      ) : null}
      <Panel padded={false}>
        {items.length ? (
          <MonitorList items={items} />
        ) : (
          <Empty icon={<Activity />} title={t("dash.monitors.emptyTitle")} action={<ButtonLink href="/dashboard/monitors/new">{t("dash.monitors.add")}</ButtonLink>}>
            {t("dash.monitors.emptyText")}
          </Empty>
        )}
      </Panel>
    </>
  );
}
