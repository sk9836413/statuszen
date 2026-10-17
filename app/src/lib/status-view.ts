import "server-only";
import { cache } from "react";
import type { ExpressionBuilder } from "kysely";
import { getCurrentUser } from "./auth/session";
import { getDb, now } from "./db";
import type { Database, Incident } from "./db/schema";
import { getActiveLanguages, getDictionary } from "./i18n/server";
import { interpolate, MESSAGES, type Translator } from "./i18n/messages";
import { getIncidentMonitorIds, getIncidentUpdates } from "./incidents";
import { toMonitorRecord, type MonitorRecord } from "./monitors";
import { getEntitlements } from "./plans";
import { getSettings } from "./settings";
import { getPageComponents, getStatusPageBySlug, overallStatus, type StatusPageRecord } from "./status-pages";
import { dayOf, getResponseSeries } from "./uptime";
import type { Impact, IncidentStatus, MonitorStatus, MonitorType, OverallStatus, PublicStatus } from "@/monitor/types";

/**
 * Read model for the public status pages (/s/[slug]), the JSON API, feeds and badges.
 * Everything here only exposes what a page owner chose to publish.
 */

/** A component's state on the page (monitor status combined with open incidents). */
export type ComponentState = OverallStatus | "paused" | "unknown";

export interface PublicIncident {
  id: number;
  kind: Incident["kind"];
  title: string;
  status: IncidentStatus;
  impact: Impact;
  startedAt: string;
  resolvedAt: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  /** Page components affected by the incident. */
  monitorIds: number[];
  /** Newest first. */
  updates: Array<{ id: number; status: IncidentStatus; message: string; createdAt: string }>;
}

export interface BarDay {
  day: string;
  /** 0–100, or null without data. */
  uptime: number | null;
  downtimeSec: number;
  /** Titles of incidents that started on this day. */
  incidents: string[];
}

export interface PublicComponent {
  monitorId: number;
  name: string;
  group: string;
  type: MonitorType;
  status: MonitorStatus;
  state: ComponentState;
  days: BarDay[];
  /** Uptime % over the last 30 / 60 / 90 days (only windows up to the page's history length). */
  uptime: Partial<Record<30 | 60 | 90, number | null>>;
  /** Hourly average response time for the last 24 h (null when hidden or not applicable). */
  response: { points: Array<number | null>; avgMs: number | null } | null;
}

export interface StatusView {
  components: PublicComponent[];
  overall: OverallStatus;
  active: PublicIncident[];
  maintenanceNow: PublicIncident[];
  maintenanceUpcoming: PublicIncident[];
}

/** Monitor types where a response time means something to visitors. */
const RESPONSE_TYPES: MonitorType[] = ["http", "keyword", "tcp", "dns"];

/** Unconfirmed subscriptions are deleted after this long. */
export const PENDING_SUBSCRIBER_TTL_MS = 7 * 86_400_000;

// ── Pages ──

/** A public page by slug (no cookies read, safe for cached API responses). */
/** Pages of banned or deleted accounts are hidden from the public. */
async function ownerActive(userId: number): Promise<boolean> {
  const db = await getDb();
  const owner = await db.selectFrom("users").select("status").where("id", "=", userId).executeTakeFirst();
  return owner?.status === "active";
}

export async function getPublicStatusPage(slug: string): Promise<StatusPageRecord | undefined> {
  const page = await getStatusPageBySlug(String(slug ?? "").replace(/\.(svg|json|xml)$/i, ""));
  return page?.isPublic && (await ownerActive(page.userId)) ? page : undefined;
}

/**
 * The page for /s/[slug]: public pages for everyone, private pages only for their
 * owner and administrators (shown with a "private" notice). Deduplicated per request.
 */
export const getViewablePage = cache(async (slug: string): Promise<{ page: StatusPageRecord; preview: boolean } | null> => {
  const page = await getStatusPageBySlug(slug);
  if (!page) return null;
  if (page.isPublic && (await ownerActive(page.userId))) return { page, preview: false };
  const user = await getCurrentUser();
  if (user && (user.id === page.userId || user.role === "admin")) return { page, preview: true };
  return null;
});

/** "Powered by …" line unless the page owner's plan removes branding. */
export async function getBranding(page: StatusPageRecord): Promise<{ text: string; url: string } | null> {
  const db = await getDb();
  const [settings, owner] = await Promise.all([
    getSettings(),
    db.selectFrom("users").select(["role", "plan_id", "plan_expires_at"]).where("id", "=", page.userId).executeTakeFirst(),
  ]);
  const entitlements = await getEntitlements(owner ?? null);
  if (entitlements.removeBranding || !settings.branding_text.trim()) return null;
  const fallback = settings.site_url || process.env.SITE_URL || "/";
  return { text: settings.branding_text.trim(), url: settings.branding_url || fallback };
}

// ── Components ──

interface PageMonitor {
  monitor: MonitorRecord;
  name: string;
  group: string;
}

export async function getPageMonitors(page: StatusPageRecord): Promise<PageMonitor[]> {
  const components = await getPageComponents(page.id);
  if (!components.length) return [];
  const db = await getDb();
  const rows = await db
    .selectFrom("monitors")
    .selectAll()
    .where("id", "in", components.map((c) => c.monitorId))
    .where("user_id", "=", page.userId)
    .execute();
  const byId = new Map(rows.map((r) => [r.id, toMonitorRecord(r)]));
  const out: PageMonitor[] = [];
  for (const c of components) {
    const monitor = byId.get(c.monitorId);
    if (monitor) out.push({ monitor, name: c.displayName.trim() || monitor.name, group: c.groupName.trim() });
  }
  return out;
}

// ── Incidents ──

/**
 * Incidents shown on a page: the owner's incidents that affect one of its components,
 * plus manual incidents and maintenance that aren't tied to any component (page-wide notices).
 */
function visibleOn(page: StatusPageRecord, monitorIds: number[]) {
  return (eb: ExpressionBuilder<Database, "incidents">) => {
    const linked = eb.exists(
      eb.selectFrom("incident_monitors").select("incident_monitors.incident_id").whereRef("incident_monitors.incident_id", "=", "incidents.id"),
    );
    const scopes = [eb.and([eb("incidents.kind", "!=", "auto"), eb.not(linked)])];
    if (monitorIds.length) {
      scopes.push(
        eb("incidents.id", "in", eb.selectFrom("incident_monitors").select("incident_monitors.incident_id").where("incident_monitors.monitor_id", "in", monitorIds)),
      );
    }
    return eb.and([eb("incidents.user_id", "=", page.userId), eb.or(scopes)]);
  };
}

async function hydrate(rows: Incident[], monitorIds: number[]): Promise<PublicIncident[]> {
  const ids = rows.map((r) => r.id);
  const [updates, monitors] = await Promise.all([getIncidentUpdates(ids), getIncidentMonitorIds(ids)]);
  const onPage = new Set(monitorIds);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    status: r.status,
    impact: r.impact,
    startedAt: r.started_at,
    resolvedAt: r.resolved_at,
    scheduledStart: r.scheduled_start,
    scheduledEnd: r.scheduled_end,
    monitorIds: (monitors.get(r.id) ?? []).filter((id) => onPage.has(id)),
    updates: (updates.get(r.id) ?? []).map((u) => ({ id: u.id, status: u.status, message: u.message, createdAt: u.created_at })),
  }));
}

/** Open incidents, maintenance in progress and upcoming maintenance. */
export async function getOpenIncidents(page: StatusPageRecord, monitorIds: number[]) {
  const db = await getDb();
  const ts = now();
  const rows = await db
    .selectFrom("incidents")
    .selectAll()
    .where(visibleOn(page, monitorIds))
    .where((eb) =>
      eb.or([
        eb.and([eb("kind", "!=", "maintenance"), eb("resolved_at", "is", null)]),
        eb.and([eb("kind", "=", "maintenance"), eb("status", "!=", "completed"), eb.or([eb("scheduled_end", "is", null), eb("scheduled_end", ">=", ts)])]),
      ]),
    )
    .orderBy("started_at", "desc")
    .limit(50)
    .execute();
  const all = await hydrate(rows, monitorIds);
  const active = all.filter((i) => i.kind !== "maintenance");
  const maintenance = all.filter((i) => i.kind === "maintenance");
  const started = (i: PublicIncident) => i.status === "in_progress" || (i.scheduledStart ?? i.startedAt) <= ts;
  return {
    active,
    maintenanceNow: maintenance.filter(started),
    maintenanceUpcoming: maintenance.filter((i) => !started(i)).sort((a, b) => (a.scheduledStart ?? a.startedAt).localeCompare(b.scheduledStart ?? b.startedAt)),
  };
}

/** Incidents and past maintenance that started in [fromIso, toIso), newest first. */
export async function getIncidentsBetween(page: StatusPageRecord, monitorIds: number[], fromIso: string, toIso: string, limit = 500): Promise<PublicIncident[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("incidents")
    .selectAll()
    .where(visibleOn(page, monitorIds))
    .where("started_at", ">=", fromIso)
    .where("started_at", "<", toIso)
    .where("started_at", "<=", now())
    .orderBy("started_at", "desc")
    .limit(limit)
    .execute();
  return hydrate(rows, monitorIds);
}

export async function getPageIncident(page: StatusPageRecord, monitorIds: number[], incidentId: number): Promise<PublicIncident | undefined> {
  if (!Number.isInteger(incidentId) || incidentId < 1) return undefined;
  const db = await getDb();
  const row = await db.selectFrom("incidents").selectAll().where(visibleOn(page, monitorIds)).where("id", "=", incidentId).executeTakeFirst();
  return row ? (await hydrate([row], monitorIds))[0] : undefined;
}

/** Incidents of the last `days` calendar days (UTC), newest first. */
export async function getRecentIncidents(page: StatusPageRecord, monitorIds: number[], days: number, limit = 200): Promise<PublicIncident[]> {
  const since = `${dayOf(new Date(Date.now() - (days - 1) * 86_400_000))}T00:00:00.000Z`;
  return getIncidentsBetween(page, monitorIds, since, new Date(Date.now() + 60_000).toISOString(), limit);
}

/** True when an unconfirmed subscription is too old to confirm. */
export function pendingExpired(createdAt: string): boolean {
  return Date.parse(createdAt) < Date.now() - PENDING_SUBSCRIBER_TTL_MS;
}

/** Start of the oldest incident on the page (for the history pagination). */
export async function getOldestIncidentStart(page: StatusPageRecord, monitorIds: number[]): Promise<string | null> {
  const db = await getDb();
  const row = await db.selectFrom("incidents").select("started_at").where(visibleOn(page, monitorIds)).orderBy("started_at", "asc").limit(1).executeTakeFirst();
  return row?.started_at ?? null;
}

// ── Uptime ──

function percent(checks: number, failures: number): number | null {
  return checks > 0 ? Math.round(((checks - failures) / checks) * 100_000) / 1000 : null;
}

async function getBars(page: StatusPageRecord, monitorIds: number[], days: number) {
  const out = new Map<number, { days: BarDay[]; uptime: PublicComponent["uptime"] }>();
  if (!monitorIds.length) return out;
  const db = await getDb();
  const since = dayOf(new Date(Date.now() - (days - 1) * 86_400_000));
  const [daily, incidents] = await Promise.all([
    db
      .selectFrom("monitor_daily")
      .select(["monitor_id", "day", "checks", "failures", "downtime_sec"])
      .where("monitor_id", "in", monitorIds)
      .where("day", ">=", since)
      .execute(),
    db
      .selectFrom("incidents")
      .innerJoin("incident_monitors", "incident_monitors.incident_id", "incidents.id")
      .select(["incidents.title", "incidents.started_at", "incident_monitors.monitor_id"])
      .where("incident_monitors.monitor_id", "in", monitorIds)
      .where("incidents.user_id", "=", page.userId)
      .where("incidents.kind", "!=", "maintenance")
      .where("incidents.started_at", ">=", since)
      .orderBy("incidents.started_at")
      .execute(),
  ]);
  const key = (id: number, day: string) => `${id}|${day}`;
  const dailyByKey = new Map(daily.map((r) => [key(r.monitor_id, r.day), r]));
  const titlesByKey = new Map<string, string[]>();
  for (const i of incidents) {
    const k = key(i.monitor_id, dayOf(i.started_at));
    titlesByKey.set(k, [...(titlesByKey.get(k) ?? []), i.title]);
  }
  const dayList = Array.from({ length: days }, (_, i) => dayOf(new Date(Date.now() - (days - 1 - i) * 86_400_000)));
  for (const id of monitorIds) {
    const bars = dayList.map((day): BarDay => {
      const r = dailyByKey.get(key(id, day));
      return {
        day,
        uptime: r && r.checks > 0 ? percent(Number(r.checks), Number(r.failures)) : null,
        downtimeSec: Number(r?.downtime_sec ?? 0),
        incidents: titlesByKey.get(key(id, day)) ?? [],
      };
    });
    const uptime: PublicComponent["uptime"] = {};
    for (const window of [30, 60, 90] as const) {
      if (window > days) continue;
      let checks = 0;
      let failures = 0;
      for (const day of dayList.slice(-window)) {
        const r = dailyByKey.get(key(id, day));
        checks += Number(r?.checks ?? 0);
        failures += Number(r?.failures ?? 0);
      }
      uptime[window] = percent(checks, failures);
    }
    out.set(id, { days: bars, uptime });
  }
  return out;
}

// ── Assembled view ──

const SEVERITY: ComponentState[] = ["major_outage", "partial_outage", "degraded", "maintenance", "operational", "unknown", "paused"];

/** The most severe of several states (for group headers). */
export function worstState(states: ComponentState[]): ComponentState {
  return SEVERITY.find((s) => states.includes(s)) ?? "operational";
}

function componentState(monitor: MonitorRecord, open: PublicIncident[]): ComponentState {
  if (monitor.status === "down") return "major_outage";
  const linked = open.filter((i) => i.monitorIds.includes(monitor.id));
  if (monitor.status === "maintenance" || linked.some((i) => i.kind === "maintenance")) return "maintenance";
  if (linked.some((i) => i.impact === "critical")) return "major_outage";
  if (linked.some((i) => i.impact === "major")) return "partial_outage";
  if (linked.some((i) => i.impact === "minor")) return "degraded";
  if (monitor.status === "paused" || !monitor.isActive) return "paused";
  if (monitor.status === "pending") return "unknown";
  return "operational";
}

export async function loadStatusView(
  page: StatusPageRecord,
  options: { bars?: boolean; response?: boolean } = {},
): Promise<StatusView & { monitorIds: number[] }> {
  const monitors = await getPageMonitors(page);
  const monitorIds = monitors.map((m) => m.monitor.id);
  const days = page.settings.historyDays;
  const wantResponse = options.response ?? page.settings.showResponseTimes;
  const [open, bars, responses] = await Promise.all([
    getOpenIncidents(page, monitorIds),
    options.bars === false ? Promise.resolve(new Map<number, { days: BarDay[]; uptime: PublicComponent["uptime"] }>()) : getBars(page, monitorIds, days),
    Promise.all(
      monitors.map(({ monitor }) =>
        wantResponse && RESPONSE_TYPES.includes(monitor.type) && monitor.isActive ? getResponseSeries(monitor.id, 24) : Promise.resolve(null),
      ),
    ),
  ]);
  const openNow = [...open.active, ...open.maintenanceNow];
  const components = monitors.map(({ monitor, name, group }, i): PublicComponent => {
    const series = responses[i];
    const values = series?.map((p) => p.avgMs) ?? [];
    const measured = values.filter((v): v is number => v !== null);
    return {
      monitorId: monitor.id,
      name,
      group,
      type: monitor.type,
      status: monitor.status,
      state: componentState(monitor, openNow),
      days: bars.get(monitor.id)?.days ?? [],
      uptime: bars.get(monitor.id)?.uptime ?? {},
      response: series && measured.length ? { points: values, avgMs: Math.round(measured.reduce((a, b) => a + b, 0) / measured.length) } : null,
    };
  });
  const overall = overallStatus(
    monitors.map((m) => m.monitor.status),
    [...open.active.map((i) => i.impact as string), ...open.maintenanceNow.map(() => "maintenance")],
  );
  return { components, overall, ...open, monitorIds };
}

// ── Translation for cookie-less requests (API, feeds) ──

/** Translator for `lang` when it is an active language, else the site default. */
export async function translatorFor(lang?: string | null): Promise<{ t: Translator; code: string }> {
  const [settings, languages] = await Promise.all([getSettings(), getActiveLanguages()]);
  const language = languages.find((l) => l.code === lang) ?? languages.find((l) => l.code === settings.default_language) ?? languages[0];
  const dictionary = language ? await getDictionary(language.code) : {};
  return { t: (key, vars) => interpolate(dictionary[key] ?? MESSAGES[key], vars), code: language?.code ?? "en" };
}

/** Public JSON for /api/status/[slug] and the sz.js widget. */
export async function buildPublicStatus(page: StatusPageRecord, t: Translator, base: string): Promise<PublicStatus> {
  const view = await loadStatusView(page, { bars: false, response: false });
  const db = await getDb();
  const since = dayOf(new Date(Date.now() - 89 * 86_400_000));
  const sums = view.monitorIds.length
    ? await db
        .selectFrom("monitor_daily")
        .select(["monitor_id", (eb) => eb.fn.sum<number>("checks").as("checks"), (eb) => eb.fn.sum<number>("failures").as("failures")])
        .where("monitor_id", "in", view.monitorIds)
        .where("day", ">=", since)
        .groupBy("monitor_id")
        .execute()
    : [];
  const uptime = new Map(sums.map((r) => [r.monitor_id, percent(Number(r.checks), Number(r.failures))]));
  const pageUrl = `${base}/s/${page.slug}`;
  return {
    name: page.name,
    url: pageUrl,
    status: view.overall,
    headline: t(`status.overall.${view.overall}`),
    components: view.components.map((c) => ({ name: c.name, group: c.group, status: c.status, uptime90: uptime.get(c.monitorId) ?? null })),
    activeIncidents: [...view.active, ...view.maintenanceNow].map((i) => ({
      title: i.title,
      status: i.status,
      impact: i.impact,
      startedAt: i.startedAt,
      url: `${pageUrl}/incidents/${i.id}`,
    })),
    updatedAt: now(),
  };
}
