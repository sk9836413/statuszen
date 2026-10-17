import crypto from "node:crypto";
import { badgeOptions, badgeResponse, BADGE_COLORS, MONITOR_BADGE, monitorBadgeKey, parseMonitorBadgeKey, renderBadge, uptimeColor, uptimeText } from "@/lib/badges";
import { getMonitor } from "@/lib/monitors";
import { getUptimePercent } from "@/lib/uptime";

/**
 * GET /badge/m/{key}.svg → one monitor's badge. `key` comes from monitorBadgeKey().
 * Options: ?type=status|uptime (uptime = last 30 days), ?style=flat|flat-square, ?label=…
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { style, label } = badgeOptions(request.url);
  const type = new URL(request.url).searchParams.get("type") === "uptime" ? "uptime" : "status";
  const defaultLabel = type === "uptime" ? "uptime" : "status";
  const key = token.replace(/\.svg$/i, "");

  const id = parseMonitorBadgeKey(key);
  const monitor = id ? await getMonitor(id) : undefined;
  const expected = monitor ? monitorBadgeKey(monitor) : "";
  const valid = monitor && expected.length === key.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(key));
  if (!monitor || !valid) {
    return badgeResponse(renderBadge({ label: label ?? defaultLabel, value: "not found", color: BADGE_COLORS.gray, style }), 404);
  }

  if (type === "uptime") {
    const uptime = (await getUptimePercent([monitor.id], 30)).get(monitor.id) ?? null;
    return badgeResponse(renderBadge({ label: label ?? defaultLabel, value: uptimeText(uptime), color: uptimeColor(uptime), style }));
  }
  const badge = MONITOR_BADGE[monitor.status];
  return badgeResponse(renderBadge({ label: label ?? defaultLabel, value: badge.text, color: badge.color, style }));
}
