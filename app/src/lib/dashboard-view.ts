import "server-only";
import type { MonitorListItem } from "@/components/dashboard/monitor-list";
import { formatInterval } from "@/monitor/format";
import type { MonitorStatus } from "@/monitor/types";
import { formatMs, formatPercent, formatRelative, uptimeBand } from "./dash-format";
import { getRollingUptime, getSparklines } from "./dashboard-data";
import type { Translator } from "./i18n/messages";
import type { MonitorRecord } from "./monitors";

/** What the dashboard shows as a monitor's state (paused wins over the last check result). */
export function effectiveStatus(m: Pick<MonitorRecord, "isActive" | "status">): MonitorStatus {
  return m.isActive ? m.status : "paused";
}

/** Rows for the monitor lists (overview and Monitors page). */
export async function buildMonitorItems(monitors: MonitorRecord[], t: Translator, locale: string): Promise<MonitorListItem[]> {
  const idList = monitors.map((m) => m.id);
  const [uptime, sparks] = await Promise.all([getRollingUptime(idList, 24), getSparklines(idList, 24)]);
  return monitors.map((m) => {
    const up = uptime.get(m.id) ?? null;
    const spark = sparks.get(m.id) ?? [];
    return {
      id: m.id,
      name: m.name,
      type: m.type,
      target: m.type === "heartbeat" ? t("dash.monitor.heartbeatTarget") : m.target,
      status: effectiveStatus(m),
      uptime: formatPercent(up, locale),
      uptimeTone: uptimeBand(up),
      response: formatMs(m.lastResponseMs, locale),
      lastCheck: m.type === "heartbeat" ? (m.lastPingAt ? formatRelative(m.lastPingAt, locale) : t("dash.monitor.noPing")) : m.lastCheckAt ? formatRelative(m.lastCheckAt, locale) : t("dash.monitor.notYet"),
      interval: t("dash.monitors.every", { interval: formatInterval(m.intervalSec, t) }),
      spark: spark.map((p) => p.ms),
      failures: spark.map((p) => p.failures),
    };
  });
}
