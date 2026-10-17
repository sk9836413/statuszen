import { badgeOptions, badgeResponse, BADGE_COLORS, OVERALL_BADGE, renderBadge } from "@/lib/badges";
import { maybeLazyTick } from "@/lib/lazy-tick";
import { getOpenIncidents, getPageMonitors, getPublicStatusPage } from "@/lib/status-view";
import { overallStatus } from "@/lib/status-pages";

/** GET /badge/{slug}.svg → overall status badge. Options: ?style=flat|flat-square&label=… */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { style, label } = badgeOptions(request.url);
  const page = await getPublicStatusPage(slug.replace(/\.svg$/i, ""));
  if (!page) return badgeResponse(renderBadge({ label: label ?? "status", value: "not found", color: BADGE_COLORS.gray, style }), 404);
  maybeLazyTick();

  const monitors = await getPageMonitors(page);
  const ids = monitors.map((m) => m.monitor.id);
  const open = await getOpenIncidents(page, ids);
  const status = overallStatus(
    monitors.map((m) => m.monitor.status),
    [...open.active.map((i) => i.impact as string), ...open.maintenanceNow.map(() => "maintenance")],
  );
  const badge = OVERALL_BADGE[status];
  return badgeResponse(renderBadge({ label: label ?? "status", value: badge.text, color: badge.color, style }));
}
