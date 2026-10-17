import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MonitorForm } from "@/components/dashboard/monitor-form";
import { DashHeader, Panel } from "@/components/dashboard/ui";
import { Alert } from "@/components/ui/alert";
import { getUserChannels } from "@/lib/channels";
import { requireDashboardUser } from "@/lib/dashboard";
import { getLocale, getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { getMonitorChannelIds, getOwnedMonitor } from "@/lib/monitors";
import { getEntitlements } from "@/lib/plans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.editMonitor.title") };
}

export default async function EditMonitorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copied?: string }> }) {
  const user = await requireDashboardUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const monitor = await getOwnedMonitor(Number(id), user.id);
  if (!monitor) notFound();
  const [t, locale, entitlements, channels, channelIds] = await Promise.all([getT(), getLocale(), getEntitlements(user), getUserChannels(user.id), getMonitorChannelIds(monitor.id)]);

  return (
    <>
      <Link href={`/dashboard/monitors/${monitor.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {monitor.name}
      </Link>
      <DashHeader title={t("dash.editMonitor.title")} description={t(`dash.type.${monitor.type}` as MessageKey)} />
      {query.copied === "1" ? (
        <Alert tone="success" className="mb-6" title={t("dash.monitor.copiedTitle")}>
          {t("dash.monitor.copiedText")}
        </Alert>
      ) : null}
      <Panel>
        <MonitorForm
          values={{
            id: monitor.id,
            type: monitor.type,
            name: monitor.name,
            config: monitor.config as unknown as Record<string, unknown>,
            intervalSec: monitor.intervalSec,
            confirmCount: monitor.confirmCount,
            isActive: monitor.isActive,
            channelIds,
          }}
          channels={channels.map((c) => ({ id: c.id, name: c.name, type: c.type, isActive: c.isActive }))}
          minIntervalSec={entitlements.minIntervalSec}
          locale={locale.code}
        />
      </Panel>
    </>
  );
}
