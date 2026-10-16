import "server-only";
import { getDb, now } from "./db";
import type { AlertChannel } from "./db/schema";
import { isChannelType, normalizeChannelConfig, parseJson } from "@/monitor/normalize";
import type { ChannelConfigByType, ChannelType } from "@/monitor/types";

export interface ChannelRecord<T extends ChannelType = ChannelType> {
  id: number;
  userId: number;
  type: T;
  name: string;
  config: ChannelConfigByType[T];
  isActive: boolean;
  createdAt: string;
}

export function toChannelRecord(row: AlertChannel): ChannelRecord | null {
  if (!isChannelType(row.type)) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    name: row.name,
    config: normalizeChannelConfig(row.type, parseJson(row.config)),
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

const records = (rows: AlertChannel[]) => rows.map(toChannelRecord).filter((c): c is ChannelRecord => c !== null);

export async function getUserChannels(userId: number): Promise<ChannelRecord[]> {
  const db = await getDb();
  return records(await db.selectFrom("alert_channels").selectAll().where("user_id", "=", userId).orderBy("id").execute());
}

export async function getOwnedChannel(channelId: number, userId: number): Promise<ChannelRecord | undefined> {
  if (!Number.isInteger(channelId) || channelId < 1) return undefined;
  const db = await getDb();
  const row = await db.selectFrom("alert_channels").selectAll().where("id", "=", channelId).where("user_id", "=", userId).executeTakeFirst();
  return row ? (toChannelRecord(row) ?? undefined) : undefined;
}

/** Active channels attached to a monitor (used when sending alerts). */
export async function getMonitorChannels(monitorId: number): Promise<ChannelRecord[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("alert_channels")
    .innerJoin("monitor_channels", "monitor_channels.channel_id", "alert_channels.id")
    .selectAll("alert_channels")
    .where("monitor_channels.monitor_id", "=", monitorId)
    .where("alert_channels.is_active", "=", 1)
    .execute();
  return records(rows);
}

export async function createChannel<T extends ChannelType>(userId: number, type: T, name: string, config: unknown): Promise<number> {
  const db = await getDb();
  const ts = now();
  const result = await db
    .insertInto("alert_channels")
    .values({ user_id: userId, type, name: name.trim().slice(0, 120) || type, config: JSON.stringify(normalizeChannelConfig(type, config)), is_active: 1, created_at: ts, updated_at: ts })
    .executeTakeFirstOrThrow();
  return Number(result.insertId);
}

export async function updateChannel(channel: Pick<ChannelRecord, "id" | "type">, input: { name?: string; config?: unknown; isActive?: boolean }): Promise<void> {
  const db = await getDb();
  await db
    .updateTable("alert_channels")
    .set({
      ...(input.name !== undefined ? { name: input.name.trim().slice(0, 120) || channel.type } : {}),
      ...(input.config !== undefined ? { config: JSON.stringify(normalizeChannelConfig(channel.type, input.config)) } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive ? 1 : 0 } : {}),
      updated_at: now(),
    })
    .where("id", "=", channel.id)
    .execute();
}

export async function deleteChannel(channelId: number): Promise<void> {
  const db = await getDb();
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("monitor_channels").where("channel_id", "=", channelId).execute();
    await trx.updateTable("alert_log").set({ channel_id: null }).where("channel_id", "=", channelId).execute();
    await trx.deleteFrom("alert_channels").where("id", "=", channelId).execute();
  });
}

export async function logAlert(entry: { monitorId: number | null; channelId: number | null; event: string; ok: boolean; error?: string | null }): Promise<void> {
  const db = await getDb();
  await db
    .insertInto("alert_log")
    .values({ monitor_id: entry.monitorId, channel_id: entry.channelId, event: entry.event, ok: entry.ok ? 1 : 0, error: entry.error ? entry.error.slice(0, 500) : null, created_at: now() })
    .execute();
}
