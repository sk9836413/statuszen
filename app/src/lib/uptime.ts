import "server-only";
import { sql } from "kysely";
import { getDb } from "./db";
import type { UptimeDay } from "@/monitor/types";

export const dayOf = (iso: string | Date = new Date()) => (typeof iso === "string" ? iso : iso.toISOString()).slice(0, 10);

/** Add one check to the monitor's daily summary (portable upsert for MySQL and SQLite). */
export async function addDailyCheck(monitorId: number, ok: boolean, responseMs: number | null, downtimeSec: number, at = new Date()): Promise<void> {
  const db = await getDb();
  const day = dayOf(at);
  const values = { checks: 1, failures: ok ? 0 : 1, total_ms: Math.max(0, responseMs ?? 0), downtime_sec: Math.max(0, Math.round(downtimeSec)) };
  const set = {
    checks: sql<number>`checks + 1`,
    failures: sql<number>`failures + ${values.failures}`,
    total_ms: sql<number>`total_ms + ${values.total_ms}`,
    downtime_sec: sql<number>`downtime_sec + ${values.downtime_sec}`,
  };
  const updated = await db.updateTable("monitor_daily").set(set).where("monitor_id", "=", monitorId).where("day", "=", day).executeTakeFirst();
  if (Number(updated.numUpdatedRows) > 0) return;
  try {
    await db.insertInto("monitor_daily").values({ monitor_id: monitorId, day, ...values }).execute();
  } catch {
    await db.updateTable("monitor_daily").set(set).where("monitor_id", "=", monitorId).where("day", "=", day).execute();
  }
}

/** Uptime % over the last `days` days from the daily summaries (null without data). */
export async function getUptimePercent(monitorIds: number[], days: number): Promise<Map<number, number | null>> {
  const out = new Map<number, number | null>(monitorIds.map((id) => [id, null]));
  if (!monitorIds.length) return out;
  const db = await getDb();
  const since = dayOf(new Date(Date.now() - (days - 1) * 86_400_000));
  const rows = await db
    .selectFrom("monitor_daily")
    .select(["monitor_id", (eb) => eb.fn.sum<number>("checks").as("checks"), (eb) => eb.fn.sum<number>("failures").as("failures")])
    .where("monitor_id", "in", monitorIds)
    .where("day", ">=", since)
    .groupBy("monitor_id")
    .execute();
  for (const r of rows) {
    const checks = Number(r.checks);
    out.set(r.monitor_id, checks ? Math.round(((checks - Number(r.failures)) / checks) * 100_000) / 1000 : null);
  }
  return out;
}

/** One entry per day (oldest first) for the uptime bars of one or more monitors combined. */
export async function getUptimeDays(monitorIds: number[], days: number): Promise<UptimeDay[]> {
  const db = await getDb();
  const since = dayOf(new Date(Date.now() - (days - 1) * 86_400_000));
  const rows = monitorIds.length
    ? await db
        .selectFrom("monitor_daily")
        .select([
          "day",
          (eb) => eb.fn.sum<number>("checks").as("checks"),
          (eb) => eb.fn.sum<number>("failures").as("failures"),
          (eb) => eb.fn.sum<number>("downtime_sec").as("downtime"),
        ])
        .where("monitor_id", "in", monitorIds)
        .where("day", ">=", since)
        .groupBy("day")
        .execute()
    : [];
  const incidentRows = monitorIds.length
    ? await db
        .selectFrom("incidents")
        .select("started_at")
        .where("monitor_id", "in", monitorIds)
        .where("kind", "=", "auto")
        .where("started_at", ">=", since)
        .execute()
    : [];
  const incidentsByDay = new Map<string, number>();
  for (const i of incidentRows) incidentsByDay.set(dayOf(i.started_at), (incidentsByDay.get(dayOf(i.started_at)) ?? 0) + 1);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: days }, (_, i) => {
    const day = dayOf(new Date(Date.now() - (days - 1 - i) * 86_400_000));
    const r = byDay.get(day);
    const checks = Number(r?.checks ?? 0);
    return {
      day,
      uptime: checks ? Math.round(((checks - Number(r!.failures)) / checks) * 10_000) / 100 : null,
      downtimeSec: Number(r?.downtime ?? 0),
      incidents: incidentsByDay.get(day) ?? 0,
    };
  });
}

/** Recent raw checks for charts and tables, newest first. */
export async function getRecentChecks(monitorId: number, options: { sinceIso?: string; limit: number }) {
  const db = await getDb();
  return db
    .selectFrom("checks")
    .selectAll()
    .where("monitor_id", "=", monitorId)
    .$if(Boolean(options.sinceIso), (qb) => qb.where("checked_at", ">=", options.sinceIso!))
    .orderBy("checked_at", "desc")
    .limit(options.limit)
    .execute();
}

/** Average response time (ms) per hour bucket for the last `hours` hours, oldest first. */
export async function getResponseSeries(monitorId: number, hours: number): Promise<Array<{ at: string; avgMs: number | null; failures: number }>> {
  const since = new Date(Date.now() - hours * 3_600_000);
  const rows = await getRecentChecks(monitorId, { sinceIso: since.toISOString(), limit: 20_000 });
  const buckets = new Map<string, { sum: number; n: number; fail: number }>();
  for (const r of rows) {
    const key = r.checked_at.slice(0, 13);
    const b = buckets.get(key) ?? { sum: 0, n: 0, fail: 0 };
    if (r.response_ms != null && r.ok) {
      b.sum += r.response_ms;
      b.n += 1;
    }
    if (!r.ok) b.fail += 1;
    buckets.set(key, b);
  }
  return Array.from({ length: hours }, (_, i) => {
    const at = new Date(since.getTime() + (i + 1) * 3_600_000).toISOString();
    const b = buckets.get(at.slice(0, 13));
    return { at, avgMs: b && b.n ? Math.round(b.sum / b.n) : null, failures: b?.fail ?? 0 };
  });
}
