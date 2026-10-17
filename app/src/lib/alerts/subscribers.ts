import "server-only";
import { getDb } from "@/lib/db";
import type { Incident } from "@/lib/db/schema";
import { mailConfigured, sendMail } from "@/lib/mail";
import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/site";
import { normalizeStatusPageSettings, parseJson } from "@/monitor/normalize";
import type { IncidentStatus } from "@/monitor/types";
import { INCIDENT_STATUS_LABELS } from "./format";

const MAX_RECIPIENTS = 5_000;
const CONCURRENCY = 5;

/**
 * Email the confirmed subscribers of every public status page (of the incident's
 * owner) that shows one of the incident's monitors. Use it when an incident is
 * opened, updated or resolved. Returns the number of emails sent; never throws.
 */
export async function notifySubscribers(incident: Incident | number, update: { status: IncidentStatus; message: string }): Promise<number> {
  try {
    const settings = await getSettings();
    if (!mailConfigured(settings)) return 0;
    const db = await getDb();
    const row = typeof incident === "number" ? await db.selectFrom("incidents").selectAll().where("id", "=", incident).executeTakeFirst() : incident;
    if (!row) return 0;

    const linked = await db.selectFrom("incident_monitors").select("monitor_id").where("incident_id", "=", row.id).execute();
    const monitorIds = [...new Set([...linked.map((r) => r.monitor_id), ...(row.monitor_id ? [row.monitor_id] : [])])];
    if (!monitorIds.length) return 0;

    const pages = (
      await db
        .selectFrom("status_pages")
        .innerJoin("status_page_monitors", "status_page_monitors.page_id", "status_pages.id")
        .select(["status_pages.id", "status_pages.slug", "status_pages.name", "status_pages.settings"])
        .where("status_pages.user_id", "=", row.user_id)
        .where("status_pages.is_public", "=", 1)
        .where("status_page_monitors.monitor_id", "in", monitorIds)
        .execute()
    ).filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i && normalizeStatusPageSettings(parseJson(p.settings)).allowSubscribe);
    if (!pages.length) return 0;

    const subscribers = await db
      .selectFrom("subscribers")
      .select(["page_id", "email", "token"])
      .where("page_id", "in", pages.map((p) => p.id))
      .where("confirmed_at", "is not", null)
      .limit(MAX_RECIPIENTS)
      .execute();
    if (!subscribers.length) return 0;

    const pageById = new Map(pages.map((p) => [p.id, p]));
    const label = INCIDENT_STATUS_LABELS[update.status] ?? update.status;
    const seen = new Set<string>();
    const jobs = subscribers.filter((s) => {
      const key = s.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let sent = 0;
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const s = jobs[next++];
        const page = pageById.get(s.page_id)!;
        const pageUrl = absoluteUrl(settings, `/s/${page.slug}`);
        const text = [
          row.title,
          `Status: ${label}`,
          "",
          update.message.trim() || defaultMessage(update.status),
          "",
          `View the status page: ${pageUrl}`,
          "",
          `You receive this email because you subscribed to updates from ${page.name}.`,
          `Unsubscribe: ${absoluteUrl(settings, `/s/${page.slug}/unsubscribe?token=${encodeURIComponent(s.token)}`)}`,
        ].join("\n");
        try {
          await sendMail({ to: s.email, subject: `[${page.name}] ${label}: ${row.title}`.slice(0, 250), text });
          sent += 1;
        } catch (error) {
          console.error("[statuszen] subscriber email failed:", error instanceof Error ? error.message : error);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
    return sent;
  } catch (error) {
    console.error("[statuszen] notifySubscribers failed:", error);
    return 0;
  }
}

function defaultMessage(status: IncidentStatus): string {
  switch (status) {
    case "investigating":
      return "We are investigating an issue.";
    case "resolved":
      return "This incident has been resolved.";
    case "scheduled":
      return "Maintenance has been scheduled.";
    case "in_progress":
      return "Scheduled maintenance is in progress.";
    case "completed":
      return "Scheduled maintenance has been completed.";
    default:
      return "There is an update on this incident.";
  }
}
