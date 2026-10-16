import "server-only";
import { getDb, now } from "./db";
import type { Incident, IncidentUpdate } from "./db/schema";
import type { Impact, IncidentStatus } from "@/monitor/types";

export const RESOLVED_STATUSES: IncidentStatus[] = ["resolved", "completed"];

export async function getOpenAutoIncident(monitorId: number): Promise<Incident | undefined> {
  const db = await getDb();
  return db
    .selectFrom("incidents")
    .selectAll()
    .where("monitor_id", "=", monitorId)
    .where("kind", "=", "auto")
    .where("resolved_at", "is", null)
    .orderBy("id", "desc")
    .executeTakeFirst();
}

/** Open an automatic incident for a monitor that went down. */
export async function openAutoIncident(input: { userId: number; monitorId: number; title: string; cause: unknown; startedAt?: string }): Promise<number> {
  const db = await getDb();
  const ts = now();
  const startedAt = input.startedAt ?? ts;
  const result = await db
    .insertInto("incidents")
    .values({
      user_id: input.userId,
      monitor_id: input.monitorId,
      kind: "auto",
      title: input.title.slice(0, 200),
      status: "investigating",
      impact: "major",
      started_at: startedAt,
      resolved_at: null,
      scheduled_start: null,
      scheduled_end: null,
      cause: JSON.stringify(input.cause ?? null).slice(0, 10_000),
      created_at: ts,
      updated_at: ts,
    })
    .executeTakeFirstOrThrow();
  const id = Number(result.insertId);
  await db.insertInto("incident_monitors").values({ incident_id: id, monitor_id: input.monitorId }).execute();
  return id;
}

export async function resolveIncident(incidentId: number, message?: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.updateTable("incidents").set({ status: "resolved", resolved_at: ts, updated_at: ts }).where("id", "=", incidentId).execute();
  if (message) await db.insertInto("incident_updates").values({ incident_id: incidentId, status: "resolved", message, created_at: ts }).execute();
}

/** Manual incidents and maintenance windows created from the dashboard. */
export async function createIncident(input: {
  userId: number;
  kind: "manual" | "maintenance";
  title: string;
  status: IncidentStatus;
  impact: Impact;
  message: string;
  monitorIds: number[];
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
}): Promise<number> {
  const db = await getDb();
  const ts = now();
  const result = await db
    .insertInto("incidents")
    .values({
      user_id: input.userId,
      monitor_id: null,
      kind: input.kind,
      title: input.title.slice(0, 200),
      status: input.status,
      impact: input.impact,
      started_at: input.scheduledStart ?? ts,
      resolved_at: input.status === "resolved" || input.status === "completed" ? ts : null,
      scheduled_start: input.scheduledStart ?? null,
      scheduled_end: input.scheduledEnd ?? null,
      cause: null,
      created_at: ts,
      updated_at: ts,
    })
    .executeTakeFirstOrThrow();
  const id = Number(result.insertId);
  if (input.monitorIds.length) {
    await db.insertInto("incident_monitors").values([...new Set(input.monitorIds)].map((monitor_id) => ({ incident_id: id, monitor_id }))).execute();
  }
  if (input.message.trim()) await db.insertInto("incident_updates").values({ incident_id: id, status: input.status, message: input.message.trim().slice(0, 5000), created_at: ts }).execute();
  return id;
}

export async function addIncidentUpdate(incidentId: number, status: IncidentStatus, message: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.insertInto("incident_updates").values({ incident_id: incidentId, status, message: message.trim().slice(0, 5000), created_at: ts }).execute();
  await db
    .updateTable("incidents")
    .set({ status, updated_at: ts, ...(RESOLVED_STATUSES.includes(status) ? { resolved_at: ts } : {}) })
    .where("id", "=", incidentId)
    .execute();
}

export async function getOwnedIncident(incidentId: number, userId: number): Promise<Incident | undefined> {
  if (!Number.isInteger(incidentId) || incidentId < 1) return undefined;
  const db = await getDb();
  return db.selectFrom("incidents").selectAll().where("id", "=", incidentId).where("user_id", "=", userId).executeTakeFirst();
}

export async function getIncidentUpdates(incidentIds: number[]): Promise<Map<number, IncidentUpdate[]>> {
  const out = new Map<number, IncidentUpdate[]>();
  if (!incidentIds.length) return out;
  const db = await getDb();
  const rows = await db.selectFrom("incident_updates").selectAll().where("incident_id", "in", incidentIds).orderBy("created_at", "desc").execute();
  for (const r of rows) out.set(r.incident_id, [...(out.get(r.incident_id) ?? []), r]);
  return out;
}

export async function getIncidentMonitorIds(incidentIds: number[]): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  if (!incidentIds.length) return out;
  const db = await getDb();
  const rows = await db.selectFrom("incident_monitors").selectAll().where("incident_id", "in", incidentIds).execute();
  for (const r of rows) out.set(r.incident_id, [...(out.get(r.incident_id) ?? []), r.monitor_id]);
  return out;
}

/** True when a maintenance window covering `monitorId` is in progress (alerts are muted). */
export async function inMaintenance(monitorId: number, at = now()): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .selectFrom("incidents")
    .innerJoin("incident_monitors", "incident_monitors.incident_id", "incidents.id")
    .select("incidents.id")
    .where("incident_monitors.monitor_id", "=", monitorId)
    .where("incidents.kind", "=", "maintenance")
    .where("incidents.status", "!=", "completed")
    .where("incidents.scheduled_start", "<=", at)
    .where("incidents.scheduled_end", ">=", at)
    .executeTakeFirst();
  return Boolean(row);
}

export async function deleteIncident(incidentId: number): Promise<void> {
  const db = await getDb();
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("incident_updates").where("incident_id", "=", incidentId).execute();
    await trx.deleteFrom("incident_monitors").where("incident_id", "=", incidentId).execute();
    await trx.deleteFrom("incidents").where("id", "=", incidentId).execute();
  });
}
