import "server-only";
import crypto from "node:crypto";
import { getDb, now } from "./db";
import type { Monitor } from "./db/schema";
import { defaultConfig, isMonitorType, monitorTarget, normalizeConfig, parseJson } from "@/monitor/normalize";
import type { ConfigByType, MonitorStatus, MonitorType } from "@/monitor/types";

/** A stored monitor with its config parsed and validated. */
export interface MonitorRecord<T extends MonitorType = MonitorType> {
  id: number;
  userId: number;
  name: string;
  type: T;
  config: ConfigByType[T];
  target: string;
  intervalSec: number;
  confirmCount: number;
  status: MonitorStatus;
  isActive: boolean;
  failStreak: number;
  lastCheckAt: string | null;
  nextCheckAt: string | null;
  lastChangeAt: string | null;
  lastResponseMs: number | null;
  lastError: string | null;
  sslExpiresAt: string | null;
  domainExpiresAt: string | null;
  heartbeatToken: string;
  lastPingAt: string | null;
  runStartedAt: string | null;
  lastReminderAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function toMonitorRecord(row: Monitor): MonitorRecord | null {
  if (!isMonitorType(row.type)) return null;
  const config = normalizeConfig(row.type, parseJson(row.config));
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    config,
    target: monitorTarget(row.type, config),
    intervalSec: row.interval_sec,
    confirmCount: row.confirm_count,
    status: row.status,
    isActive: row.is_active === 1,
    failStreak: row.fail_streak,
    lastCheckAt: row.last_check_at,
    nextCheckAt: row.next_check_at,
    lastChangeAt: row.last_change_at,
    lastResponseMs: row.last_response_ms,
    lastError: row.last_error,
    sslExpiresAt: row.ssl_expires_at,
    domainExpiresAt: row.domain_expires_at,
    heartbeatToken: row.heartbeat_token,
    lastPingAt: row.last_ping_at,
    runStartedAt: row.run_started_at,
    lastReminderAt: row.last_reminder_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const records = (rows: Monitor[]) => rows.map(toMonitorRecord).filter((m): m is MonitorRecord => m !== null);

export function randomToken(length: number): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(length), (b) => alphabet[b % alphabet.length]).join("");
}

export async function getUserMonitors(userId: number): Promise<MonitorRecord[]> {
  const db = await getDb();
  return records(await db.selectFrom("monitors").selectAll().where("user_id", "=", userId).orderBy("sort_order").orderBy("id").execute());
}

export async function countUserMonitors(userId: number): Promise<number> {
  const db = await getDb();
  const row = await db.selectFrom("monitors").select((eb) => eb.fn.countAll<number>().as("n")).where("user_id", "=", userId).executeTakeFirst();
  return Number(row?.n ?? 0);
}

/** A monitor owned by `userId`, or undefined. Always use this for ids from user input (prevents IDOR). */
export async function getOwnedMonitor(monitorId: number, userId: number): Promise<MonitorRecord | undefined> {
  if (!Number.isInteger(monitorId) || monitorId < 1) return undefined;
  const db = await getDb();
  const row = await db.selectFrom("monitors").selectAll().where("id", "=", monitorId).where("user_id", "=", userId).executeTakeFirst();
  return row ? (toMonitorRecord(row) ?? undefined) : undefined;
}

export async function getMonitor(monitorId: number): Promise<MonitorRecord | undefined> {
  const db = await getDb();
  const row = await db.selectFrom("monitors").selectAll().where("id", "=", monitorId).executeTakeFirst();
  return row ? (toMonitorRecord(row) ?? undefined) : undefined;
}

export async function getMonitorByHeartbeatToken(token: string): Promise<MonitorRecord | undefined> {
  if (!/^[A-Za-z0-9]{16,40}$/.test(token)) return undefined;
  const db = await getDb();
  const row = await db.selectFrom("monitors").selectAll().where("heartbeat_token", "=", token).executeTakeFirst();
  return row ? (toMonitorRecord(row) ?? undefined) : undefined;
}

export interface MonitorInput<T extends MonitorType = MonitorType> {
  name: string;
  type: T;
  config: unknown;
  intervalSec: number;
  confirmCount?: number;
  isActive?: boolean;
}

export async function createMonitor(userId: number, input: MonitorInput): Promise<number> {
  const db = await getDb();
  const ts = now();
  const config = normalizeConfig(input.type, input.config ?? defaultConfig(input.type));
  const result = await db
    .insertInto("monitors")
    .values({
      user_id: userId,
      name: input.name.trim().slice(0, 120) || monitorTarget(input.type, config) || input.type,
      type: input.type,
      config: JSON.stringify(config),
      interval_sec: input.intervalSec,
      confirm_count: Math.min(5, Math.max(1, input.confirmCount ?? 2)),
      status: input.isActive === false ? "paused" : "pending",
      is_active: input.isActive === false ? 0 : 1,
      fail_streak: 0,
      last_check_at: null,
      // Check new monitors on the next tick. Heartbeats wait for their first ping.
      next_check_at: input.type === "heartbeat" ? new Date(Date.now() + input.intervalSec * 1000).toISOString() : ts,
      last_change_at: ts,
      last_response_ms: null,
      last_error: null,
      ssl_expires_at: null,
      domain_expires_at: null,
      heartbeat_token: randomToken(24),
      last_ping_at: null,
      run_started_at: null,
      last_reminder_at: null,
      sort_order: 0,
      created_at: ts,
      updated_at: ts,
    })
    .executeTakeFirstOrThrow();
  return Number(result.insertId);
}

export async function updateMonitor(monitor: Pick<MonitorRecord, "id" | "type">, input: Partial<Omit<MonitorInput, "type">>): Promise<void> {
  const db = await getDb();
  await db
    .updateTable("monitors")
    .set({
      ...(input.name !== undefined ? { name: input.name.trim().slice(0, 120) || monitor.type } : {}),
      ...(input.config !== undefined ? { config: JSON.stringify(normalizeConfig(monitor.type, input.config)) } : {}),
      ...(input.intervalSec !== undefined ? { interval_sec: input.intervalSec, next_check_at: now() } : {}),
      ...(input.confirmCount !== undefined ? { confirm_count: Math.min(5, Math.max(1, input.confirmCount)) } : {}),
      ...(input.isActive !== undefined
        ? { is_active: input.isActive ? 1 : 0, status: input.isActive ? "pending" : "paused", fail_streak: 0, next_check_at: now() }
        : {}),
      updated_at: now(),
    })
    .where("id", "=", monitor.id)
    .execute();
}

/** Delete a monitor and everything that belongs to it. */
export async function deleteMonitor(monitorId: number): Promise<void> {
  const db = await getDb();
  await db.transaction().execute(async (trx) => {
    for (const table of ["checks", "monitor_daily", "monitor_channels", "status_page_monitors", "incident_monitors"] as const) {
      await trx.deleteFrom(table).where("monitor_id", "=", monitorId).execute();
    }
    const ts = now();
    await trx
      .updateTable("incidents")
      .set({ status: "resolved", resolved_at: ts, updated_at: ts })
      .where("monitor_id", "=", monitorId)
      .where("kind", "=", "auto")
      .where("resolved_at", "is", null)
      .execute();
    await trx.updateTable("incidents").set({ monitor_id: null }).where("monitor_id", "=", monitorId).execute();
    await trx.updateTable("alert_log").set({ monitor_id: null }).where("monitor_id", "=", monitorId).execute();
    await trx.deleteFrom("monitors").where("id", "=", monitorId).execute();
  });
}

/** Channel ids attached to a monitor. */
export async function getMonitorChannelIds(monitorId: number): Promise<number[]> {
  const db = await getDb();
  return (await db.selectFrom("monitor_channels").select("channel_id").where("monitor_id", "=", monitorId).execute()).map((r) => r.channel_id);
}

/** Replace a monitor's alert channels; ids must already be checked for ownership. */
export async function setMonitorChannels(monitorId: number, channelIds: number[]): Promise<void> {
  const db = await getDb();
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("monitor_channels").where("monitor_id", "=", monitorId).execute();
    const unique = [...new Set(channelIds)];
    if (unique.length) await trx.insertInto("monitor_channels").values(unique.map((channel_id) => ({ monitor_id: monitorId, channel_id }))).execute();
  });
}
