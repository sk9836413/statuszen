/**
 * The contract shared by the check engine (src/lib/checks, src/lib/scheduler.ts),
 * the alerts (src/lib/alerts), the dashboard forms and the public status pages.
 *
 * Keep this file free of imports and runtime dependencies: it is used on the
 * server, in client components and in the tiny status widget script.
 */

export const MONITOR_TYPES = ["http", "keyword", "tcp", "ssl", "domain", "dns", "heartbeat"] as const;
export type MonitorType = (typeof MONITOR_TYPES)[number];

export const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface HttpConfig {
  url: string;
  method: HttpMethod;
  headers: Array<{ name: string; value: string }>;
  /** Request body for POST/PUT/PATCH. */
  body: string;
  /** Accepted status codes, e.g. "200-299" or "200,201,301". */
  expectedStatus: string;
  timeoutSec: number;
  followRedirects: boolean;
  /** Treat responses slower than this as a failure (0 = off). */
  maxResponseMs: number;
}

export interface KeywordConfig extends HttpConfig {
  keyword: string;
  /** "present": fail when the keyword is missing; "absent": fail when it appears. */
  keywordMode: "present" | "absent";
  caseSensitive: boolean;
}

export interface TcpConfig {
  host: string;
  port: number;
  timeoutSec: number;
}

export interface SslConfig {
  host: string;
  port: number;
  /** Send an "expiring soon" alert this many days before the certificate expires. */
  warnDays: number;
}

export interface DomainConfig {
  domain: string;
  /** Send an "expiring soon" alert this many days before the registration expires. */
  warnDays: number;
}

export const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

export interface DnsConfig {
  host: string;
  recordType: DnsRecordType;
  /** One of the answers must contain this text ("" = any answer is fine). */
  expected: string;
}

export interface HeartbeatConfig {
  /** Extra time after the expected interval before the job counts as missed. */
  graceSec: number;
}

export interface ConfigByType {
  http: HttpConfig;
  keyword: KeywordConfig;
  tcp: TcpConfig;
  ssl: SslConfig;
  domain: DomainConfig;
  dns: DnsConfig;
  heartbeat: HeartbeatConfig;
}

export type MonitorConfig<T extends MonitorType = MonitorType> = ConfigByType[T];

export type MonitorStatus = "pending" | "up" | "down" | "paused" | "maintenance";

/** Result of one check run by src/lib/checks. */
export interface CheckResult {
  ok: boolean;
  statusCode: number | null;
  responseMs: number | null;
  /** Short, human-readable reason for a failure (shown in alerts and the dashboard). */
  error: string | null;
  /** Expiry dates learnt during the check (ssl/domain monitors). */
  sslExpiresAt?: string | null;
  domainExpiresAt?: string | null;
}

/** Allowed check intervals (seconds). Plans set the minimum. */
export const INTERVAL_CHOICES = [30, 60, 120, 300, 600, 900, 1800, 3600, 21600, 86400] as const;

// ── Alerts ──

export const CHANNEL_TYPES = ["email", "webhook", "slack", "discord", "telegram", "teams"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export interface ChannelConfigByType {
  /** Comma-separated addresses. */
  email: { to: string };
  /** Payload signed with HMAC-SHA256 of `secret` in the X-Statuszen-Signature header. */
  webhook: { url: string; secret: string };
  slack: { webhookUrl: string };
  discord: { webhookUrl: string };
  teams: { webhookUrl: string };
  telegram: { botToken: string; chatId: string };
}

export type ChannelConfig<T extends ChannelType = ChannelType> = ChannelConfigByType[T];

export const ALERT_EVENTS = ["down", "up", "reminder", "ssl_expiring", "domain_expiring", "test"] as const;
export type AlertEvent = (typeof ALERT_EVENTS)[number];

/** What every alert channel receives (also the JSON body of webhook alerts). */
export interface AlertPayload {
  event: AlertEvent;
  monitor: { id: number; name: string; type: MonitorType; target: string };
  status: MonitorStatus;
  /** Failure reason for "down"/"reminder". */
  error: string | null;
  responseMs: number | null;
  /** ISO time the monitor went down (down/up/reminder). */
  downSince: string | null;
  /** Seconds of downtime, for "up". */
  downtimeSec: number | null;
  /** ISO expiry date for ssl_expiring / domain_expiring. */
  expiresAt: string | null;
  /** Link to the monitor in the dashboard. */
  url: string;
  sentAt: string;
}

// ── Incidents ──

export const INCIDENT_STATUSES = ["investigating", "identified", "monitoring", "resolved"] as const;
export const MAINTENANCE_STATUSES = ["scheduled", "in_progress", "completed"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number] | (typeof MAINTENANCE_STATUSES)[number];
export const IMPACTS = ["none", "minor", "major", "critical", "maintenance"] as const;
export type Impact = (typeof IMPACTS)[number];

// ── Status pages ──

export interface StatusPageSettings {
  theme: "light" | "dark" | "auto";
  /** Hex accent colour ("" = platform colour). */
  accent: string;
  /** Days of history in the uptime bars. */
  historyDays: 30 | 60 | 90;
  showUptimePercent: boolean;
  showResponseTimes: boolean;
  /** Visitors may subscribe to incident emails. */
  allowSubscribe: boolean;
  /** Short message shown at the top (e.g. planned migration). */
  announcement: string;
  /** Link for the logo / "Back to site". */
  websiteUrl: string;
  /** Ask search engines not to index the page. */
  noindex: boolean;
}

export const DEFAULT_STATUS_PAGE_SETTINGS: StatusPageSettings = {
  theme: "auto",
  accent: "",
  historyDays: 90,
  showUptimePercent: true,
  showResponseTimes: true,
  allowSubscribe: true,
  announcement: "",
  websiteUrl: "",
  noindex: false,
};

/** Overall state shown in the status page banner. */
export type OverallStatus = "operational" | "degraded" | "partial_outage" | "major_outage" | "maintenance";

/** One bar in the uptime history (one day). */
export interface UptimeDay {
  day: string;
  /** 0–100, or null when there is no data for that day. */
  uptime: number | null;
  downtimeSec: number;
  incidents: number;
}

/** Public JSON at GET /api/status/{slug} (also used by the status widget sz.js). */
export interface PublicStatus {
  name: string;
  url: string;
  status: OverallStatus;
  /** Localised headline, e.g. "All systems operational". */
  headline: string;
  components: Array<{ name: string; group: string; status: MonitorStatus; uptime90: number | null }>;
  activeIncidents: Array<{ title: string; status: IncidentStatus; impact: Impact; startedAt: string; url: string }>;
  updatedAt: string;
}
