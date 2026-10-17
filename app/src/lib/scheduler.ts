import "server-only";
import crypto from "node:crypto";
import { sql } from "kysely";
import { notifySubscribers } from "@/lib/alerts";
import { humanDuration } from "@/lib/alerts/format";
import { runCheck } from "@/lib/checks";
import { getDb } from "@/lib/db";
import { addIncidentUpdate } from "@/lib/incidents";
import { maybeExpiryAlert, recordResult } from "@/lib/monitor-state";
import { toMonitorRecord, type MonitorRecord } from "@/lib/monitors";
import { getEntitlements, type Entitlements } from "@/lib/plans";
import { getSettings } from "@/lib/settings";

/**
 * The check scheduler. One "tick" runs every due monitor within a time budget.
 * It is started by:
 *   - cron:   GET /api/cron/tick?key=SECRET (cPanel cron, Vercel cron, any pinger)
 *   - worker: `npm run worker` (calls the cron URL every 15 s)
 *   - lazy:   page views when no tick ran for a minute (setting `lazy_scheduler`)
 *   - manual: Admin → System → Run checks now
 * A lock row in `settings` keeps ticks from overlapping.
 */

export type TickSource = "cron" | "worker" | "lazy" | "manual";

export interface TickSummary {
  source: TickSource;
  startedAt: string;
  /** Monitors checked (heartbeats included when they were evaluated). */
  checked: number;
  /** Monitors that went down in this tick. */
  down: number;
  /** Monitors that recovered in this tick. */
  recovered: number;
  alertsSent: number;
  /** Due monitors left for the next tick because the time budget ran out. */
  deferred: number;
  durationMs: number;
  /** Another tick was running: nothing was done. */
  skippedLocked: boolean;
}

const KEY = {
  lock: "scheduler_lock",
  lastTickAt: "scheduler_last_tick_at",
  lastSource: "scheduler_last_source",
  lastSummary: "scheduler_last_summary",
  housekeeping: "scheduler_housekeeping_day",
  cronSecret: "cron_secret",
} as const;

const CONCURRENCY = 10;
const BATCH = 200;
/** Picked monitors are claimed this far ahead, so overlapping ticks never check them twice. */
const CLAIM_MS = 10 * 60_000;
/** Registries rate-limit RDAP, and expiry dates change rarely. */
const MIN_DOMAIN_INTERVAL_SEC = 6 * 3_600;
const ALERT_LOG_RETENTION_DAYS = 90;

// ── settings rows that are not part of SETTING_DEFAULTS ──

async function readRaw(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.selectFrom("settings").select("value").where("key", "=", key).executeTakeFirst();
  return row?.value ?? null;
}

async function writeRaw(key: string, value: string | null): Promise<void> {
  const db = await getDb();
  const exists = await db.selectFrom("settings").select("key").where("key", "=", key).executeTakeFirst();
  if (exists) {
    await db.updateTable("settings").set({ value }).where("key", "=", key).execute();
    return;
  }
  try {
    await db.insertInto("settings").values({ key, value }).execute();
  } catch {
    await db.updateTable("settings").set({ value }).where("key", "=", key).execute();
  }
}

/** Secret for /api/cron/tick: env CRON_SECRET, else one generated once and stored in settings. */
export async function getCronSecret(): Promise<string> {
  const fromEnv = process.env.CRON_SECRET?.trim();
  if (fromEnv) return fromEnv;
  const stored = await readRaw(KEY.cronSecret);
  if (stored) return stored;
  const secret = crypto.randomBytes(24).toString("base64url");
  const db = await getDb();
  try {
    await db.insertInto("settings").values({ key: KEY.cronSecret, value: secret }).execute();
    return secret;
  } catch {
    // Another request created it at the same moment.
    return (await readRaw(KEY.cronSecret)) ?? secret;
  }
}

/** Replace the stored secret (no effect while CRON_SECRET is set in the environment). */
export async function regenerateCronSecret(): Promise<string> {
  const secret = crypto.randomBytes(24).toString("base64url");
  await writeRaw(KEY.cronSecret, secret);
  return getCronSecret();
}

export function cronSecretFromEnv(): boolean {
  return Boolean(process.env.CRON_SECRET?.trim());
}

/** Constant-time comparison for the cron key. */
export async function isValidCronSecret(candidate: string | null | undefined): Promise<boolean> {
  if (!candidate) return false;
  const secret = await getCronSecret();
  const a = crypto.createHash("sha256").update(candidate).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function getLastTickAt(): Promise<string | null> {
  return readRaw(KEY.lastTickAt);
}

export interface SchedulerStatus {
  lastTickAt: string | null;
  lastSource: TickSource | null;
  lastSummary: TickSummary | null;
  /** Active monitors whose check is more than 2 minutes late. */
  overdue: number;
  locked: boolean;
  /** A tick finished in the last 3 minutes. */
  healthy: boolean;
}

export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  const db = await getDb();
  const [lastTickAt, lastSource, lastSummary, lock, overdue] = await Promise.all([
    readRaw(KEY.lastTickAt),
    readRaw(KEY.lastSource),
    readRaw(KEY.lastSummary),
    readRaw(KEY.lock),
    db
      .selectFrom("monitors")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .where("is_active", "=", 1)
      .where("type", "!=", "heartbeat")
      .where("next_check_at", "<", new Date(Date.now() - 120_000).toISOString())
      .executeTakeFirst(),
  ]);
  let summary: TickSummary | null = null;
  try {
    summary = lastSummary ? (JSON.parse(lastSummary) as TickSummary) : null;
  } catch {
    summary = null;
  }
  return {
    lastTickAt,
    lastSource: (lastSource as TickSource | null) ?? null,
    lastSummary: summary,
    overdue: Number(overdue?.n ?? 0),
    locked: Boolean(lock && lock > new Date().toISOString()),
    healthy: Boolean(lastTickAt && Date.now() - Date.parse(lastTickAt) < 3 * 60_000),
  };
}

// ── lock ──

async function acquireLock(ttlMs: number): Promise<string | null> {
  const db = await getDb();
  const nowIso = new Date().toISOString();
  const until = new Date(Date.now() + ttlMs).toISOString();
  const exists = await db.selectFrom("settings").select("key").where("key", "=", KEY.lock).executeTakeFirst();
  if (!exists) {
    try {
      await db.insertInto("settings").values({ key: KEY.lock, value: until }).execute();
      return until;
    } catch {
      // Created concurrently: fall through to the atomic update.
    }
  }
  const result = await db
    .updateTable("settings")
    .set({ value: until })
    .where("key", "=", KEY.lock)
    .where((eb) => eb.or([eb("value", "is", null), eb("value", "=", ""), eb("value", "<", nowIso)]))
    .executeTakeFirst();
  return Number(result.numUpdatedRows) === 1 ? until : null;
}

async function releaseLock(token: string): Promise<void> {
  const db = await getDb();
  await db.updateTable("settings").set({ value: null }).where("key", "=", KEY.lock).where("value", "=", token).execute();
}

// ── helpers ──

const iso = (ms: number) => new Date(ms).toISOString();

function effectiveIntervalSec(monitor: MonitorRecord, ent: Entitlements | undefined): number {
  if (monitor.type === "heartbeat") return Math.max(30, monitor.intervalSec);
  let sec = Math.max(monitor.intervalSec, ent?.minIntervalSec ?? 300, 10);
  if (monitor.type === "domain") sec = Math.max(sec, MIN_DOMAIN_INTERVAL_SEC);
  return sec;
}

/** Up to 10 % later (max 60 s) so monitors created together spread out. */
const jitterMs = (intervalSec: number) => Math.floor(Math.random() * Math.min(intervalSec * 100, 60_000));

/** Moves maintenance windows along and keeps monitor statuses in sync with them. */
async function syncMaintenance(): Promise<void> {
  const db = await getDb();
  const nowIso = new Date().toISOString();

  // scheduled → in_progress → completed, with subscriber emails.
  const starting = await db
    .selectFrom("incidents")
    .selectAll()
    .where("kind", "=", "maintenance")
    .where("status", "=", "scheduled")
    .where("scheduled_start", "<=", nowIso)
    .where("scheduled_end", ">", nowIso)
    .limit(50)
    .execute();
  for (const m of starting) {
    const message = "Scheduled maintenance is in progress.";
    await addIncidentUpdate(m.id, "in_progress", message);
    await notifySubscribers({ ...m, status: "in_progress" }, { status: "in_progress", message });
  }
  const ending = await db
    .selectFrom("incidents")
    .selectAll()
    .where("kind", "=", "maintenance")
    .where("status", "in", ["scheduled", "in_progress"])
    .where("scheduled_end", "<=", nowIso)
    .limit(50)
    .execute();
  for (const m of ending) {
    const message = "Scheduled maintenance has been completed.";
    await addIncidentUpdate(m.id, "completed", message);
    await notifySubscribers({ ...m, status: "completed" }, { status: "completed", message });
  }

  const covered = (
    await db
      .selectFrom("incident_monitors")
      .innerJoin("incidents", "incidents.id", "incident_monitors.incident_id")
      .select("incident_monitors.monitor_id")
      .where("incidents.kind", "=", "maintenance")
      .where("incidents.status", "!=", "completed")
      .where("incidents.scheduled_start", "<=", nowIso)
      .where("incidents.scheduled_end", ">=", nowIso)
      .execute()
  ).map((r) => r.monitor_id);

  if (covered.length) {
    await db
      .updateTable("monitors")
      .set({ status: "maintenance", fail_streak: 0, last_change_at: nowIso })
      .where("id", "in", covered)
      .where("is_active", "=", 1)
      .where("status", "!=", "maintenance")
      .execute();
  }
  // Window over: check again right away to learn the real status.
  await db
    .updateTable("monitors")
    .set({ status: "pending", next_check_at: nowIso, last_change_at: nowIso })
    .where("status", "=", "maintenance")
    .where("is_active", "=", 1)
    .$if(covered.length > 0, (qb) => qb.where("id", "not in", covered))
    .execute();
}

async function housekeeping(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if ((await readRaw(KEY.housekeeping)) === today) return;
  await writeRaw(KEY.housekeeping, today);
  const db = await getDb();
  const settings = await getSettings();
  const days = Math.max(1, Number(settings.check_retention_days) || 30);
  await db.deleteFrom("checks").where("checked_at", "<", iso(Date.now() - days * 86_400_000)).execute();
  await db.deleteFrom("alert_log").where("created_at", "<", iso(Date.now() - ALERT_LOG_RETENTION_DAYS * 86_400_000)).execute();
}

// ── heartbeat ──

async function evaluateHeartbeat(monitor: MonitorRecord, at: number): Promise<{ checked: boolean; transition: "down" | "up" | null; alertsSent: number }> {
  const db = await getDb();
  const grace = (monitor.config as { graceSec?: number }).graceSec ?? 300;
  const interval = effectiveIntervalSec(monitor, undefined);
  // A new or resumed heartbeat ("pending") gets a full period from when it was saved.
  const bases = [monitor.lastPingAt ?? monitor.createdAt];
  if (monitor.status === "pending") bases.push(monitor.updatedAt);
  const base = Math.max(...bases.map((b) => Date.parse(b) || 0));
  const deadline = base + (interval + grace) * 1000;

  if (at <= deadline) {
    await db.updateTable("monitors").set({ next_check_at: iso(deadline + 1000) }).where("id", "=", monitor.id).execute();
    return { checked: false, transition: null, alertsSent: 0 };
  }
  const silentFor = humanDuration((at - base) / 1000);
  const outcome = await recordResult(
    monitor,
    {
      ok: false,
      statusCode: null,
      responseMs: null,
      error: monitor.lastPingAt ? `No ping received for ${silentFor} (expected every ${humanDuration(interval)})` : `No ping received yet (expected every ${humanDuration(interval)})`,
    },
    { at: new Date(at), nextCheckAt: iso(at + interval * 1000), immediateDown: true },
  );
  return { checked: true, transition: outcome.transition, alertsSent: outcome.alertsSent };
}

// ── tick ──

export async function runTick({ budgetMs = 25_000, source }: { budgetMs?: number; source: TickSource }): Promise<TickSummary> {
  const started = Date.now();
  const summary: TickSummary = {
    source,
    startedAt: iso(started),
    checked: 0,
    down: 0,
    recovered: 0,
    alertsSent: 0,
    deferred: 0,
    durationMs: 0,
    skippedLocked: false,
  };
  const lock = await acquireLock(budgetMs + 30_000);
  if (!lock) {
    summary.skippedLocked = true;
    summary.durationMs = Date.now() - started;
    return summary;
  }

  try {
    const db = await getDb();
    const settings = await getSettings();
    const deadline = started + budgetMs;

    try {
      await syncMaintenance();
    } catch (error) {
      console.error("[statuszen] maintenance sync failed:", error);
    }

    const rows = await db
      .selectFrom("monitors")
      .selectAll()
      .where("is_active", "=", 1)
      .where("next_check_at", "<=", iso(Date.now()))
      .orderBy("next_check_at")
      .limit(BATCH)
      .execute();

    if (rows.length) {
      // Claim the batch so an overlapping tick (expired lock, second server) skips it.
      await db
        .updateTable("monitors")
        .set({ next_check_at: iso(Date.now() + CLAIM_MS) })
        .where("id", "in", rows.map((r) => r.id))
        .execute();

      const monitors = rows.map(toMonitorRecord).filter((m): m is MonitorRecord => m !== null);
      const users = await db
        .selectFrom("users")
        .select(["id", "role", "status", "plan_id", "plan_expires_at"])
        .where("id", "in", [...new Set(monitors.map((m) => m.userId))])
        .execute();
      const userById = new Map(users.map((u) => [u.id, u]));
      const entitlements = new Map<number, Promise<Entitlements>>();
      const entFor = (userId: number) => {
        let p = entitlements.get(userId);
        if (!p) {
          const u = userById.get(userId);
          p = getEntitlements(u ? { role: u.role, plan_id: u.plan_id, plan_expires_at: u.plan_expires_at } : null);
          entitlements.set(userId, p);
        }
        return p;
      };

      const queue = [...monitors];
      const processOne = async (monitor: MonitorRecord) => {
        const owner = userById.get(monitor.userId);
        const ent = await entFor(monitor.userId);
        const interval = effectiveIntervalSec(monitor, ent);
        const at = Date.now();
        if (!owner || owner.status !== "active") {
          // Banned or deleted owner: don't check, look again later.
          await db.updateTable("monitors").set({ next_check_at: iso(at + interval * 1000) }).where("id", "=", monitor.id).execute();
          return;
        }
        if (monitor.type === "heartbeat") {
          const r = await evaluateHeartbeat(monitor, at);
          if (r.checked) summary.checked += 1;
          if (r.transition === "down") summary.down += 1;
          summary.alertsSent += r.alertsSent;
          return;
        }
        const result = await runCheck(monitor, { allowPrivate: settings.allow_private_targets });
        const done = Date.now();
        const outcome = await recordResult(monitor, result, {
          at: new Date(done),
          nextCheckAt: iso(done + interval * 1000 + jitterMs(interval)),
          recheckAt: iso(done + Math.min(30, interval) * 1000),
        });
        summary.checked += 1;
        if (outcome.transition === "down") summary.down += 1;
        if (outcome.transition === "up") summary.recovered += 1;
        summary.alertsSent += outcome.alertsSent;
        if (outcome.status !== "maintenance") summary.alertsSent += await maybeExpiryAlert(monitor, result);
      };

      const worker = async () => {
        while (queue.length && Date.now() < deadline) {
          const monitor = queue.shift()!;
          try {
            await processOne(monitor);
          } catch (error) {
            console.error(`[statuszen] check of monitor ${monitor.id} failed:`, error);
            // Retry in a minute instead of waiting for the claim to expire.
            await db.updateTable("monitors").set({ next_check_at: iso(Date.now() + 60_000) }).where("id", "=", monitor.id).execute().catch(() => undefined);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

      // Out of time: give the claimed but unchecked monitors back to the next tick.
      if (queue.length) {
        summary.deferred = queue.length;
        await db
          .updateTable("monitors")
          .set({ next_check_at: iso(Date.now()) })
          .where("id", "in", queue.map((m) => m.id))
          .execute();
      }
    }

    if (Date.now() < deadline) {
      try {
        await housekeeping();
      } catch (error) {
        console.error("[statuszen] housekeeping failed:", error);
      }
    }
  } finally {
    summary.durationMs = Date.now() - started;
    try {
      await writeRaw(KEY.lastTickAt, iso(Date.now()));
      await writeRaw(KEY.lastSource, source);
      await writeRaw(KEY.lastSummary, JSON.stringify(summary));
    } finally {
      await releaseLock(lock).catch(() => undefined);
    }
  }
  return summary;
}

/** For the admin page: number of rows in the checks table (rough storage indicator). */
export async function countStoredChecks(): Promise<number> {
  const db = await getDb();
  const row = await sql<{ n: number }>`select count(*) as n from checks`.execute(db);
  return Number(row.rows[0]?.n ?? 0);
}
