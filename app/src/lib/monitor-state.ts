import "server-only";
import { notifyMonitor, notifySubscribers } from "@/lib/alerts";
import { humanDuration } from "@/lib/alerts/format";
import { getDb } from "@/lib/db";
import type { MonitorsTable } from "@/lib/db/schema";
import { addIncidentUpdate, getOpenAutoIncident, inMaintenance, openAutoIncident, resolveIncident } from "@/lib/incidents";
import type { MonitorRecord } from "@/lib/monitors";
import { addDailyCheck } from "@/lib/uptime";
import type { CheckResult, MonitorStatus } from "@/monitor/types";

/**
 * What happens after a check (or a heartbeat ping): store the result, update the
 * daily summary, flip the monitor up/down with confirmation, open/resolve the
 * automatic incident, alert channels and status page subscribers.
 * Shared by the scheduler (src/lib/scheduler.ts) and the ping endpoint.
 */

export const REMINDER_EVERY_MS = 60 * 60_000;

export interface RecordOptions {
  at?: Date;
  /** Next check when the result is final (success or confirmed failure). */
  nextCheckAt: string | null;
  /** Next check while a failure is not confirmed yet (defaults to nextCheckAt). */
  recheckAt?: string | null;
  /** Mark down on the first failure (heartbeat fail pings and missed pings). */
  immediateDown?: boolean;
  /** Extra monitor columns to write (heartbeat: last_ping_at, run_started_at). */
  extra?: Partial<Pick<MonitorsTable, "last_ping_at" | "run_started_at">>;
}

export interface RecordOutcome {
  status: MonitorStatus;
  transition: "down" | "up" | null;
  alertsSent: number;
}

const secondsBetween = (fromIso: string | null, to: Date, cap = 86_400) =>
  fromIso ? Math.min(cap, Math.max(0, (to.getTime() - Date.parse(fromIso)) / 1000)) : 0;

export async function recordResult(monitor: MonitorRecord, result: CheckResult, opts: RecordOptions): Promise<RecordOutcome> {
  const db = await getDb();
  const at = opts.at ?? new Date();
  const nowIso = at.toISOString();
  const prev = monitor.status;
  const maintenance = await inMaintenance(monitor.id, nowIso);

  await db
    .insertInto("checks")
    .values({
      monitor_id: monitor.id,
      ok: result.ok ? 1 : 0,
      status_code: result.statusCode,
      response_ms: result.responseMs,
      error: result.ok ? null : (result.error ?? "Check failed").slice(0, 500),
      checked_at: nowIso,
    })
    .execute();

  let status: MonitorStatus = prev;
  let failStreak = monitor.failStreak;
  let lastChangeAt = monitor.lastChangeAt;
  let lastReminderAt = monitor.lastReminderAt;
  let nextCheckAt = opts.nextCheckAt;
  let transition: RecordOutcome["transition"] = null;
  let remind = false;
  const sinceLast = secondsBetween(monitor.lastCheckAt ?? monitor.lastPingAt, at);

  if (maintenance) {
    // Inside a maintenance window: no incidents, no alerts, and it doesn't count as downtime.
    if (prev !== "maintenance") lastChangeAt = nowIso;
    status = "maintenance";
    failStreak = 0;
    await addDailyCheck(monitor.id, true, result.ok ? result.responseMs : null, 0, at);
  } else if (result.ok) {
    failStreak = 0;
    if (prev !== "up") {
      status = "up";
      lastChangeAt = nowIso;
      // "down" → recovered. Also covers an incident still open from before a maintenance window.
      if (prev === "down" || (await getOpenAutoIncident(monitor.id))) transition = "up";
    }
    await addDailyCheck(monitor.id, true, result.responseMs, prev === "down" ? sinceLast : 0, at);
  } else {
    failStreak = monitor.failStreak + 1;
    if (prev === "down") {
      const lastNotice = lastReminderAt ?? lastChangeAt;
      if (!lastNotice || at.getTime() - Date.parse(lastNotice) >= REMINDER_EVERY_MS) {
        remind = true;
        lastReminderAt = nowIso;
      }
    } else if (opts.immediateDown || failStreak >= Math.max(1, monitor.confirmCount)) {
      status = "down";
      lastChangeAt = nowIso;
      lastReminderAt = nowIso;
      transition = "down";
    } else {
      // Not confirmed yet: check again soon instead of waiting a full interval.
      nextCheckAt = opts.recheckAt ?? opts.nextCheckAt;
    }
    await addDailyCheck(monitor.id, false, result.responseMs, status === "down" ? sinceLast : 0, at);
  }

  await db
    .updateTable("monitors")
    .set({
      status,
      fail_streak: failStreak,
      last_check_at: nowIso,
      next_check_at: nextCheckAt,
      last_change_at: lastChangeAt,
      last_reminder_at: lastReminderAt,
      last_response_ms: result.responseMs,
      last_error: result.ok ? null : (result.error ?? "Check failed").slice(0, 500),
      ...(result.sslExpiresAt !== undefined ? { ssl_expires_at: result.sslExpiresAt } : {}),
      ...(result.domainExpiresAt !== undefined ? { domain_expires_at: result.domainExpiresAt } : {}),
      ...(opts.extra ?? {}),
    })
    .where("id", "=", monitor.id)
    // Paused while the check was running: keep the user's change.
    .where("is_active", "=", 1)
    .execute();

  let alertsSent = 0;
  const updated: MonitorRecord = { ...monitor, status, failStreak, lastChangeAt, lastReminderAt, lastCheckAt: nowIso };

  if (transition === "down") {
    let incident = await getOpenAutoIncident(monitor.id);
    if (!incident) {
      const id = await openAutoIncident({
        userId: monitor.userId,
        monitorId: monitor.id,
        title: `${monitor.name} is down`,
        cause: { error: result.error, statusCode: result.statusCode, responseMs: result.responseMs, checkedAt: nowIso, target: monitor.target },
        startedAt: nowIso,
      });
      const message = `Our monitoring detected that ${monitor.name} is not responding. We are investigating.`;
      await addIncidentUpdate(id, "investigating", message);
      incident = await getOpenAutoIncident(monitor.id);
      if (incident) await notifySubscribers(incident, { status: "investigating", message });
    }
    alertsSent += (await notifyMonitor(updated, "down", { status: "down", error: result.error, responseMs: result.responseMs, downSince: nowIso })).sent;
  } else if (transition === "up") {
    const incident = await getOpenAutoIncident(monitor.id);
    const downSince = incident?.started_at ?? monitor.lastChangeAt;
    const downtimeSec = Math.round(secondsBetween(downSince, at, Number.MAX_SAFE_INTEGER));
    if (incident) {
      const message = `${monitor.name} is responding again after ${humanDuration(downtimeSec)} of downtime.`;
      await resolveIncident(incident.id, message);
      await notifySubscribers({ ...incident, status: "resolved", resolved_at: nowIso }, { status: "resolved", message });
    }
    alertsSent += (await notifyMonitor(updated, "up", { status: "up", responseMs: result.responseMs, downSince, downtimeSec })).sent;
  } else if (remind) {
    alertsSent += (await notifyMonitor(updated, "reminder", { status: "down", error: result.error, responseMs: result.responseMs, downSince: monitor.lastChangeAt })).sent;
  }

  return { status, transition, alertsSent };
}

/**
 * "Expires soon" alerts for SSL and domain monitors: at most once per 24 hours
 * (tracked in alert_log), never during maintenance.
 */
export async function maybeExpiryAlert(monitor: MonitorRecord, result: CheckResult): Promise<number> {
  const isSsl = monitor.type === "ssl";
  if (!isSsl && monitor.type !== "domain") return 0;
  if (!result.ok) return 0;
  const expiresAt = (isSsl ? result.sslExpiresAt : result.domainExpiresAt) ?? (isSsl ? monitor.sslExpiresAt : monitor.domainExpiresAt);
  if (!expiresAt) return 0;
  const warnDays = (monitor.config as { warnDays?: number }).warnDays ?? (isSsl ? 14 : 30);
  const msLeft = Date.parse(expiresAt) - Date.now();
  if (!(msLeft > 0 && msLeft <= warnDays * 86_400_000)) return 0;
  const event = isSsl ? "ssl_expiring" : "domain_expiring";
  const db = await getDb();
  const recent = await db
    .selectFrom("alert_log")
    .select("id")
    .where("monitor_id", "=", monitor.id)
    .where("event", "=", event)
    .where("created_at", ">=", new Date(Date.now() - 86_400_000).toISOString())
    .executeTakeFirst();
  if (recent) return 0;
  if (await inMaintenance(monitor.id)) return 0;
  return (await notifyMonitor(monitor, event, { expiresAt })).sent;
}
