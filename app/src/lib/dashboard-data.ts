import "server-only";
import { cache } from "react";
import { sql } from "kysely";
import { getDb, now } from "./db";
import type { Incident } from "./db/schema";
import { RESOLVED_STATUSES } from "./incidents";
import { getUserMonitors } from "./monitors";

/**
 * Read models for the customer dashboard: charts, lists and joins that the
 * core data layer (monitors.ts, incidents.ts…) does not need itself.
 * Callers must pass ids that were already checked for ownership.
 */

const HOUR = 3_600_000;

/** Uptime % over the last `hours` hours from the raw checks (rolling window, unlike the daily summaries). */
export async function getRollingUptime(monitorIds: number[], hours: number): Promise<Map<number, number | null>> {
  const out = new Map<number, number | null>(monitorIds.map((id) => [id, null]));
  if (!monitorIds.length) return out;
  const db = await getDb();
  const since = new Date(Date.now() - hours * HOUR).toISOString();
  const rows = await db
    .selectFrom("checks")
    .select(["monitor_id", (eb) => eb.fn.countAll<number>().as("n"), (eb) => eb.fn.sum<number>("ok").as("ok")])
    .where("monitor_id", "in", monitorIds)
    .where("checked_at", ">=", since)
    .groupBy("monitor_id")
    .execute();
  for (const r of rows) {
    const n = Number(r.n);
    out.set(r.monitor_id, n ? Math.round((Number(r.ok) / n) * 100_000) / 1000 : null);
  }
  return out;
}

export interface SparkPoint {
  /** Average response time of the successful checks in the hour (null = none). */
  ms: number | null;
  failures: number;
  checks: number;
}

/** Hourly response-time points for small sparklines, oldest first (`hours` entries per monitor). */
export async function getSparklines(monitorIds: number[], hours = 24): Promise<Map<number, SparkPoint[]>> {
  const out = new Map<number, SparkPoint[]>();
  if (!monitorIds.length) return out;
  const db = await getDb();
  const start = Date.now() - hours * HOUR;
  const since = new Date(start).toISOString();
  const bucket = sql<string>`substr(checked_at, 1, 13)`;
  const rows = await db
    .selectFrom("checks")
    .select([
      "monitor_id",
      bucket.as("hour"),
      (eb) => eb.fn.countAll<number>().as("n"),
      (eb) => eb.fn.sum<number>("ok").as("ok"),
      sql<number | null>`avg(case when ok = 1 then response_ms end)`.as("avg_ms"),
    ])
    .where("monitor_id", "in", monitorIds)
    .where("checked_at", ">=", since)
    .groupBy(["monitor_id", bucket])
    .execute();
  const byKey = new Map(rows.map((r) => [`${r.monitor_id}|${r.hour}`, r]));
  for (const id of monitorIds) {
    out.set(
      id,
      Array.from({ length: hours }, (_, i) => {
        const key = new Date(start + (i + 1) * HOUR).toISOString().slice(0, 13);
        const r = byKey.get(`${id}|${key}`);
        const n = Number(r?.n ?? 0);
        return { ms: r?.avg_ms != null ? Math.round(Number(r.avg_ms)) : null, failures: n - Number(r?.ok ?? 0), checks: n };
      }),
    );
  }
  return out;
}

/** Response-time series for the detail chart: `points` buckets over the last `hours` hours, oldest first. */
export async function getResponseBuckets(
  monitorId: number,
  hours: number,
  points: number,
): Promise<Array<{ at: string; avgMs: number | null; minMs: number | null; maxMs: number | null; failures: number; checks: number }>> {
  const db = await getDb();
  const end = Date.now();
  const start = end - hours * HOUR;
  const size = (end - start) / points;
  const rows = await db
    .selectFrom("checks")
    .select(["ok", "response_ms", "checked_at"])
    .where("monitor_id", "=", monitorId)
    .where("checked_at", ">=", new Date(start).toISOString())
    .orderBy("checked_at")
    .limit(50_000)
    .execute();
  const buckets = Array.from({ length: points }, (_, i) => ({ at: new Date(start + (i + 1) * size).toISOString(), sum: 0, n: 0, min: Infinity, max: 0, failures: 0, checks: 0 }));
  for (const r of rows) {
    const i = Math.min(points - 1, Math.max(0, Math.floor((Date.parse(r.checked_at) - start) / size)));
    const b = buckets[i];
    b.checks += 1;
    if (!r.ok) b.failures += 1;
    else if (r.response_ms != null) {
      b.sum += r.response_ms;
      b.n += 1;
      b.min = Math.min(b.min, r.response_ms);
      b.max = Math.max(b.max, r.response_ms);
    }
  }
  return buckets.map((b) => ({
    at: b.at,
    avgMs: b.n ? Math.round(b.sum / b.n) : null,
    minMs: b.n ? b.min : null,
    maxMs: b.n ? b.max : null,
    failures: b.failures,
    checks: b.checks,
  }));
}

export async function countMonitorChecks(monitorId: number): Promise<number> {
  const db = await getDb();
  const row = await db.selectFrom("checks").select((eb) => eb.fn.countAll<number>().as("n")).where("monitor_id", "=", monitorId).executeTakeFirst();
  return Number(row?.n ?? 0);
}

export async function getChecksPage(monitorId: number, page: number, perPage: number) {
  const db = await getDb();
  return db
    .selectFrom("checks")
    .selectAll()
    .where("monitor_id", "=", monitorId)
    .orderBy("checked_at", "desc")
    .orderBy("id", "desc")
    .limit(perPage)
    .offset((page - 1) * perPage)
    .execute();
}

/** Last alerts sent for a monitor, newest first, with the channel name. */
export async function getMonitorAlertLog(monitorId: number, limit = 20) {
  const db = await getDb();
  return db
    .selectFrom("alert_log")
    .leftJoin("alert_channels", "alert_channels.id", "alert_log.channel_id")
    .select(["alert_log.id", "alert_log.event", "alert_log.ok", "alert_log.error", "alert_log.created_at", "alert_channels.name as channel_name", "alert_channels.type as channel_type"])
    .where("alert_log.monitor_id", "=", monitorId)
    .orderBy("alert_log.created_at", "desc")
    .orderBy("alert_log.id", "desc")
    .limit(limit)
    .execute();
}

/** Incidents (any kind) that affect a monitor, newest first. */
export async function getMonitorIncidents(monitorId: number, limit = 10): Promise<Incident[]> {
  const db = await getDb();
  return db
    .selectFrom("incidents")
    .innerJoin("incident_monitors", "incident_monitors.incident_id", "incidents.id")
    .selectAll("incidents")
    .where("incident_monitors.monitor_id", "=", monitorId)
    .orderBy("incidents.started_at", "desc")
    .limit(limit)
    .execute();
}

/** A user's incidents of the given kinds, newest first. */
export async function getUserIncidents(userId: number, options: { kinds: Incident["kind"][]; open?: boolean; limit?: number }): Promise<Incident[]> {
  const db = await getDb();
  return db
    .selectFrom("incidents")
    .selectAll()
    .where("user_id", "=", userId)
    .where("kind", "in", options.kinds)
    .$if(options.open === true, (qb) => qb.where("status", "not in", RESOLVED_STATUSES))
    .$if(options.open === false, (qb) => qb.where("status", "in", RESOLVED_STATUSES))
    .orderBy("started_at", "desc")
    .orderBy("id", "desc")
    .limit(options.limit ?? 200)
    .execute();
}

export async function countOpenIncidents(userId: number): Promise<number> {
  const db = await getDb();
  const row = await db
    .selectFrom("incidents")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("user_id", "=", userId)
    .where("kind", "!=", "maintenance")
    .where("status", "not in", RESOLVED_STATUSES)
    .executeTakeFirst();
  return Number(row?.n ?? 0);
}

/** Edit a scheduled maintenance window (the incident lib only creates them). */
export async function updateMaintenance(
  incidentId: number,
  input: { title: string; scheduledStart: string; scheduledEnd: string; monitorIds: number[] },
): Promise<void> {
  const db = await getDb();
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("incidents")
      .set({ title: input.title.slice(0, 200), scheduled_start: input.scheduledStart, scheduled_end: input.scheduledEnd, started_at: input.scheduledStart, updated_at: now() })
      .where("id", "=", incidentId)
      .execute();
    await trx.deleteFrom("incident_monitors").where("incident_id", "=", incidentId).execute();
    const ids = [...new Set(input.monitorIds)];
    if (ids.length) await trx.insertInto("incident_monitors").values(ids.map((monitor_id) => ({ incident_id: incidentId, monitor_id }))).execute();
  });
}

/** Monitors using each of a user's channels (channel id → monitor ids). */
export async function getChannelUsage(userId: number): Promise<Map<number, number[]>> {
  const db = await getDb();
  const rows = await db
    .selectFrom("monitor_channels")
    .innerJoin("monitors", "monitors.id", "monitor_channels.monitor_id")
    .select(["monitor_channels.channel_id", "monitor_channels.monitor_id"])
    .where("monitors.user_id", "=", userId)
    .execute();
  const out = new Map<number, number[]>();
  for (const r of rows) out.set(r.channel_id, [...(out.get(r.channel_id) ?? []), r.monitor_id]);
  return out;
}

/** Number of active (not paused) monitors, for plan limits when resuming. */
export async function countActiveMonitors(userId: number): Promise<number> {
  const db = await getDb();
  const row = await db
    .selectFrom("monitors")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("user_id", "=", userId)
    .where("is_active", "=", 1)
    .executeTakeFirst();
  return Number(row?.n ?? 0);
}

// ── Status page subscribers ──

export async function countSubscribers(pageIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>(pageIds.map((id) => [id, 0]));
  if (!pageIds.length) return out;
  const db = await getDb();
  const rows = await db
    .selectFrom("subscribers")
    .select(["page_id", (eb) => eb.fn.countAll<number>().as("n")])
    .where("page_id", "in", pageIds)
    .where("confirmed_at", "is not", null)
    .groupBy("page_id")
    .execute();
  for (const r of rows) out.set(r.page_id, Number(r.n));
  return out;
}

export async function getSubscribers(pageId: number, limit = 10_000) {
  const db = await getDb();
  return db.selectFrom("subscribers").select(["id", "email", "confirmed_at", "created_at"]).where("page_id", "=", pageId).orderBy("created_at", "desc").limit(limit).execute();
}

export async function deleteSubscriber(pageId: number, subscriberId: number): Promise<boolean> {
  const db = await getDb();
  const result = await db.deleteFrom("subscribers").where("page_id", "=", pageId).where("id", "=", subscriberId).executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

/** Number of components on each page. */
export async function countPageComponents(pageIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>(pageIds.map((id) => [id, 0]));
  if (!pageIds.length) return out;
  const db = await getDb();
  const rows = await db
    .selectFrom("status_page_monitors")
    .select(["page_id", (eb) => eb.fn.countAll<number>().as("n")])
    .where("page_id", "in", pageIds)
    .groupBy("page_id")
    .execute();
  for (const r of rows) out.set(r.page_id, Number(r.n));
  return out;
}

/** The user's monitors, loaded once per request (layout + page share it). */
export const getUserMonitorsCached = cache(async (userId: number) => getUserMonitors(userId));
