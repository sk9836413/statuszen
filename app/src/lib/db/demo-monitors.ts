import "server-only";
import crypto from "node:crypto";
import type { Insertable, Kysely, Transaction } from "kysely";
import type { ChecksTable, Database, MonitorDailyTable } from "./schema";
import { DEFAULT_STATUS_PAGE_SETTINGS } from "@/monitor/types";

/**
 * Demo content for the monitoring features: monitors owned by the administrator
 * that check real public endpoints, 90 days of history, past incidents, a planned
 * maintenance and a public status page shown on the platform's home page.
 */

const DAY = 86_400_000;
type Tx = Transaction<Database> | Kysely<Database>;

function token(length: number): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(length), (b) => alphabet[b % alphabet.length]).join("");
}

interface DemoMonitor {
  name: string;
  type: string;
  config: Record<string, unknown>;
  group: string;
  /** Typical response time in ms (for the generated history). */
  ms: number;
  /** Days ago with an outage in the generated history, and its length in minutes. */
  outages: Array<[number, number]>;
}

export async function seedDemoMonitors(trx: Tx, options: { adminId: number; siteUrl: string; rand: () => number }): Promise<string> {
  const { rand } = options;
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const created = iso(92 * DAY);
  // Local installs can't monitor themselves (private addresses are blocked), so use a public site there.
  const local = /^https?:\/\/(localhost|127\.|10\.|192\.168\.|\[?::1)/i.test(options.siteUrl);
  const ownUrl = /^https?:\/\//.test(options.siteUrl) && !local ? options.siteUrl.replace(/\/$/, "") : "https://example.com";
  const ownHost = new URL(ownUrl).hostname;

  const http = (url: string, extra: Record<string, unknown> = {}) => ({
    url,
    method: "GET",
    headers: [],
    body: "",
    expectedStatus: "200-299",
    timeoutSec: 15,
    followRedirects: true,
    maxResponseMs: 0,
    ...extra,
  });

  const monitors: DemoMonitor[] = [
    { name: "Website", type: "http", config: http(ownUrl), group: "Website", ms: 240, outages: [[23, 14]] },
    {
      name: "Pricing page",
      type: "keyword",
      config: http(`${ownUrl}/pricing`, { keyword: "pricing", keywordMode: "present", caseSensitive: false }),
      group: "Website",
      ms: 310,
      outages: [],
    },
    { name: "Public API", type: "http", config: http("https://api.github.com/zen"), group: "API", ms: 180, outages: [[61, 38], [9, 6]] },
    { name: "Docs", type: "http", config: http("https://example.com/"), group: "API", ms: 120, outages: [] },
    { name: "SSL certificate", type: "ssl", config: { host: ownHost, port: 443, warnDays: 14 }, group: "Website", ms: 90, outages: [] },
    { name: "Domain", type: "domain", config: { domain: "example.com", warnDays: 30 }, group: "Website", ms: 0, outages: [] },
    { name: "DNS", type: "dns", config: { host: "example.com", recordType: "A", expected: "" }, group: "API", ms: 30, outages: [] },
    { name: "Nightly backup", type: "heartbeat", config: { graceSec: 3600 }, group: "Background jobs", ms: 0, outages: [[40, 1440]] },
  ];

  const ids: number[] = [];
  for (const [i, m] of monitors.entries()) {
    const heartbeat = m.type === "heartbeat";
    const interval = heartbeat ? 86_400 : 300;
    const result = await trx
      .insertInto("monitors")
      .values({
        user_id: options.adminId,
        name: m.name,
        type: m.type,
        config: JSON.stringify(m.config),
        interval_sec: interval,
        confirm_count: 2,
        status: "up",
        is_active: 1,
        fail_streak: 0,
        last_check_at: iso(60_000),
        // Real checks start on the next scheduler run.
        next_check_at: heartbeat ? iso(-interval * 1000) : iso(0),
        last_change_at: iso(9 * DAY),
        last_response_ms: m.ms || null,
        last_error: null,
        ssl_expires_at: m.type === "ssl" ? iso(-74 * DAY) : null,
        domain_expires_at: m.type === "domain" ? iso(-210 * DAY) : null,
        heartbeat_token: token(24),
        last_ping_at: heartbeat ? iso(2 * 3_600_000) : null,
        run_started_at: null,
        last_reminder_at: null,
        sort_order: i,
        created_at: created,
        updated_at: created,
      })
      .executeTakeFirstOrThrow();
    ids.push(Number(result.insertId));
  }

  // 90 days of daily summaries with the outages listed above.
  const daily: Insertable<MonitorDailyTable>[] = [];
  for (const [i, m] of monitors.entries()) {
    const perDay = m.type === "heartbeat" ? 1 : 288;
    for (let d = 89; d >= 0; d--) {
      const day = new Date(now - d * DAY).toISOString().slice(0, 10);
      const checks = d === 0 ? Math.max(1, Math.round((perDay * (now % DAY)) / DAY)) : perDay;
      const outage = m.outages.find(([ago]) => ago === d);
      const failures = outage ? (m.type === "heartbeat" ? 1 : Math.max(1, Math.round(outage[1] / 5))) : 0;
      const jitter = 0.85 + rand() * 0.3;
      daily.push({
        monitor_id: ids[i],
        day,
        checks,
        failures,
        total_ms: Math.round(m.ms * jitter * (checks - failures)),
        downtime_sec: outage ? outage[1] * 60 : 0,
      });
    }
  }
  for (let i = 0; i < daily.length; i += 200) await trx.insertInto("monitor_daily").values(daily.slice(i, i + 200)).execute();

  // Raw checks for the last 24 hours (response-time charts).
  const checks: Insertable<ChecksTable>[] = [];
  for (const [i, m] of monitors.entries()) {
    if (m.type === "heartbeat" || m.type === "domain") continue;
    for (let k = 288; k >= 1; k--) {
      const wave = 1 + 0.15 * Math.sin((k / 288) * Math.PI * 2);
      checks.push({
        monitor_id: ids[i],
        ok: 1,
        status_code: m.type === "http" || m.type === "keyword" ? 200 : null,
        response_ms: Math.round(m.ms * wave * (0.8 + rand() * 0.4) + (rand() < 0.02 ? m.ms * 2 : 0)),
        error: null,
        checked_at: iso(k * 300_000),
      });
    }
  }
  for (let i = 0; i < checks.length; i += 200) await trx.insertInto("checks").values(checks.slice(i, i + 200)).execute();

  // Past incidents (resolved) matching the outages, with updates.
  const incident = async (monitorIdx: number | null, title: string, daysAgo: number, minutes: number, updates: Array<[string, string]>, kind: "auto" | "manual" = "auto") => {
    const start = now - daysAgo * DAY + 9 * 3_600_000;
    const end = start + minutes * 60_000;
    const result = await trx
      .insertInto("incidents")
      .values({
        user_id: options.adminId,
        monitor_id: monitorIdx === null ? null : ids[monitorIdx],
        kind,
        title,
        status: "resolved",
        impact: minutes > 30 ? "major" : "minor",
        started_at: new Date(start).toISOString(),
        resolved_at: new Date(end).toISOString(),
        scheduled_start: null,
        scheduled_end: null,
        cause: kind === "auto" ? JSON.stringify({ statusCode: 503, error: "Expected 200-299, got 503" }) : null,
        created_at: new Date(start).toISOString(),
        updated_at: new Date(end).toISOString(),
      })
      .executeTakeFirstOrThrow();
    const id = Number(result.insertId);
    if (monitorIdx !== null) await trx.insertInto("incident_monitors").values({ incident_id: id, monitor_id: ids[monitorIdx] }).execute();
    const step = (end - start) / Math.max(1, updates.length - 1);
    await trx
      .insertInto("incident_updates")
      .values(updates.map(([status, message], u) => ({ incident_id: id, status: status as "investigating", message, created_at: new Date(start + step * u).toISOString() })))
      .execute();
  };
  await incident(2, "Public API returning errors", 61, 38, [
    ["investigating", "We're seeing elevated error rates on the public API and are looking into it."],
    ["identified", "A database failover caused the errors. Traffic is being moved back to the primary."],
    ["resolved", "The API is working normally again. We're sorry for the trouble."],
  ]);
  await incident(0, "Website unavailable", 23, 14, [
    ["investigating", "The website is not loading for some visitors."],
    ["resolved", "A faulty deploy was rolled back and the website is back online."],
  ]);
  await incident(2, "Slow API responses", 9, 6, [
    ["investigating", "API requests are slower than usual."],
    ["resolved", "Response times are back to normal."],
  ]);
  await incident(7, "Nightly backup did not run", 40, 1440, [
    ["investigating", "The nightly backup job did not report in."],
    ["resolved", "The backup server's disk was full. Space was freed and the backup completed."],
  ]);

  // Planned maintenance in four days.
  const mStart = new Date(Math.ceil((now + 4 * DAY) / 3_600_000) * 3_600_000);
  const maintenance = await trx
    .insertInto("incidents")
    .values({
      user_id: options.adminId,
      monitor_id: null,
      kind: "maintenance",
      title: "Database upgrade",
      status: "scheduled",
      impact: "maintenance",
      started_at: mStart.toISOString(),
      resolved_at: null,
      scheduled_start: mStart.toISOString(),
      scheduled_end: new Date(mStart.getTime() + 2 * 3_600_000).toISOString(),
      cause: null,
      created_at: iso(DAY),
      updated_at: iso(DAY),
    })
    .executeTakeFirstOrThrow();
  const maintenanceId = Number(maintenance.insertId);
  await trx.insertInto("incident_monitors").values([{ incident_id: maintenanceId, monitor_id: ids[2] }]).execute();
  await trx
    .insertInto("incident_updates")
    .values({ incident_id: maintenanceId, status: "scheduled", message: "We'll upgrade our database. The API may be unavailable for a few minutes during this window.", created_at: iso(DAY) })
    .execute();

  // Alert channel (email to the administrator) attached to every monitor.
  const admin = await trx.selectFrom("users").select("email").where("id", "=", options.adminId).executeTakeFirstOrThrow();
  const channel = await trx
    .insertInto("alert_channels")
    .values({ user_id: options.adminId, type: "email", name: "Team email", config: JSON.stringify({ to: admin.email }), is_active: 1, created_at: created, updated_at: created })
    .executeTakeFirstOrThrow();
  await trx.insertInto("monitor_channels").values(ids.map((monitor_id) => ({ monitor_id, channel_id: Number(channel.insertId) }))).execute();

  // Public status page.
  const slug = "demo";
  const page = await trx
    .insertInto("status_pages")
    .values({
      user_id: options.adminId,
      slug,
      name: "Northwind",
      description: "Live status of the Northwind website, API and background jobs.",
      logo: null,
      settings: JSON.stringify({ ...DEFAULT_STATUS_PAGE_SETTINGS, websiteUrl: ownUrl }),
      is_public: 1,
      created_at: created,
      updated_at: created,
    })
    .executeTakeFirstOrThrow();
  const shown = [0, 1, 4, 2, 3, 6, 7];
  await trx
    .insertInto("status_page_monitors")
    .values(
      shown.map((idx, sort) => ({
        page_id: Number(page.insertId),
        monitor_id: ids[idx],
        group_name: monitors[idx].group,
        display_name: monitors[idx].name,
        sort_order: sort,
      })),
    )
    .execute();
  await trx
    .insertInto("subscribers")
    .values(
      ["anna@example.com", "dev-team@example.com", "ops@example.com"].map((email, i) => ({
        page_id: Number(page.insertId),
        email,
        token: token(32),
        confirmed_at: iso((i + 2) * DAY),
        created_at: iso((i + 2) * DAY),
      })),
    )
    .execute();
  return slug;
}
