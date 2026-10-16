/**
 * Turns untrusted input (dashboard forms, stored JSON) into complete, valid
 * monitor, channel and status page settings. Unknown keys are dropped, missing
 * keys get defaults and numbers are clamped. Dependency-free.
 */

import {
  CHANNEL_TYPES,
  DEFAULT_STATUS_PAGE_SETTINGS,
  DNS_RECORD_TYPES,
  HTTP_METHODS,
  MONITOR_TYPES,
  type ChannelConfigByType,
  type ChannelType,
  type ConfigByType,
  type MonitorType,
  type StatusPageSettings,
} from "./types";

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});

export function isMonitorType(v: unknown): v is MonitorType {
  return typeof v === "string" && (MONITOR_TYPES as readonly string[]).includes(v);
}

export function isChannelType(v: unknown): v is ChannelType {
  return typeof v === "string" && (CHANNEL_TYPES as readonly string[]).includes(v);
}

function str(v: unknown, fallback: string, max = 500): string {
  if (typeof v !== "string") return fallback;
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "on" || v === 1 || v === "1") return true;
  if (v === "false" || v === "off" || v === 0 || v === "0") return false;
  return fallback;
}

function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** http(s) URL or "". */
export function httpUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  const value = v.trim().slice(0, 1000);
  return /^https?:\/\/[^\s"'<>]+$/i.test(value) ? value : "";
}

/** "https://Example.com/path" → "example.com"; plain hostnames are kept. "" when invalid. */
export function hostOnly(v: unknown): string {
  if (typeof v !== "string") return "";
  let value = v.trim().toLowerCase();
  if (!value) return "";
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(value)) value = `http://${value}`;
  try {
    const host = new URL(value).hostname.replace(/\.$/, "");
    return host.replace(/^\[|\]$/g, "");
  } catch {
    return "";
  }
}

/** Parses "200-299,301" into a matcher; invalid input falls back to 2xx. */
export function parseExpectedStatus(spec: string): (code: number) => boolean {
  const ranges: Array<[number, number]> = [];
  for (const part of spec.split(",")) {
    const m = part.trim().match(/^(\d{3})(?:\s*-\s*(\d{3}))?$/);
    if (m) ranges.push([Number(m[1]), Number(m[2] ?? m[1])]);
  }
  if (!ranges.length) ranges.push([200, 299]);
  return (code) => ranges.some(([a, b]) => code >= a && code <= b);
}

const DEFAULTS: { [T in MonitorType]: ConfigByType[T] } = {
  http: { url: "", method: "GET", headers: [], body: "", expectedStatus: "200-299", timeoutSec: 15, followRedirects: true, maxResponseMs: 0 },
  keyword: {
    url: "",
    method: "GET",
    headers: [],
    body: "",
    expectedStatus: "200-299",
    timeoutSec: 15,
    followRedirects: true,
    maxResponseMs: 0,
    keyword: "",
    keywordMode: "present",
    caseSensitive: false,
  },
  tcp: { host: "", port: 443, timeoutSec: 10 },
  ssl: { host: "", port: 443, warnDays: 14 },
  domain: { domain: "", warnDays: 30 },
  dns: { host: "", recordType: "A", expected: "" },
  heartbeat: { graceSec: 300 },
};

export function defaultConfig<T extends MonitorType>(type: T): ConfigByType[T] {
  return structuredClone(DEFAULTS[type]);
}

function httpPart(o: Obj, d: ConfigByType["http"]): ConfigByType["http"] {
  const headers = Array.isArray(o.headers)
    ? o.headers
        .map((h) => asObj(h))
        .map((h) => ({ name: str(h.name, "", 100).replace(/[^A-Za-z0-9!#$%&'*+.^_`|~-]/g, ""), value: str(h.value, "", 1000).replace(/[\r\n]/g, " ") }))
        .filter((h) => h.name)
        .slice(0, 20)
    : d.headers;
  return {
    url: o.url === undefined ? d.url : httpUrl(o.url),
    method: oneOf(o.method, HTTP_METHODS, d.method),
    headers,
    body: str(o.body, d.body, 10_000),
    expectedStatus: /^[\d\s,-]{3,100}$/.test(String(o.expectedStatus ?? "")) ? String(o.expectedStatus).trim() : d.expectedStatus,
    timeoutSec: num(o.timeoutSec, d.timeoutSec, 1, 60),
    followRedirects: bool(o.followRedirects, d.followRedirects),
    maxResponseMs: num(o.maxResponseMs, d.maxResponseMs, 0, 60_000),
  };
}

export function normalizeConfig<T extends MonitorType>(type: T, input: unknown): ConfigByType[T] {
  const o = asObj(input);
  const d = DEFAULTS[type] as unknown as Obj;
  let out: unknown;
  switch (type) {
    case "http":
      out = httpPart(o, DEFAULTS.http);
      break;
    case "keyword":
      out = {
        ...httpPart(o, DEFAULTS.keyword),
        keyword: str(o.keyword, "", 500),
        keywordMode: oneOf(o.keywordMode, ["present", "absent"] as const, "present"),
        caseSensitive: bool(o.caseSensitive, false),
      };
      break;
    case "tcp":
      out = { host: o.host === undefined ? "" : hostOnly(o.host), port: num(o.port, d.port as number, 1, 65535), timeoutSec: num(o.timeoutSec, 10, 1, 60) };
      break;
    case "ssl":
      out = { host: o.host === undefined ? "" : hostOnly(o.host), port: num(o.port, 443, 1, 65535), warnDays: num(o.warnDays, 14, 1, 120) };
      break;
    case "domain":
      out = { domain: o.domain === undefined ? "" : hostOnly(o.domain).replace(/^www\./, ""), warnDays: num(o.warnDays, 30, 1, 365) };
      break;
    case "dns":
      out = { host: o.host === undefined ? "" : hostOnly(o.host), recordType: oneOf(o.recordType, DNS_RECORD_TYPES, "A"), expected: str(o.expected, "", 255) };
      break;
    case "heartbeat":
      out = { graceSec: num(o.graceSec, 300, 0, 86_400) };
      break;
  }
  return out as ConfigByType[T];
}

/** Human-readable target shown in lists and alerts. */
export function monitorTarget(type: MonitorType, config: unknown): string {
  const c = asObj(config);
  switch (type) {
    case "http":
    case "keyword":
      return String(c.url ?? "");
    case "tcp":
      return `${c.host ?? ""}:${c.port ?? ""}`;
    case "ssl":
      return `${c.host ?? ""}${c.port && c.port !== 443 ? `:${c.port}` : ""}`;
    case "domain":
      return String(c.domain ?? "");
    case "dns":
      return `${c.recordType ?? "A"} ${c.host ?? ""}`;
    case "heartbeat":
      return "Heartbeat";
  }
}

/** Missing required fields for a type ("" when complete). Used before saving. */
export function configProblem(type: MonitorType, config: unknown): string {
  const c = asObj(config);
  if ((type === "http" || type === "keyword") && !c.url) return "Enter a full URL starting with http:// or https://.";
  if (type === "keyword" && !c.keyword) return "Enter the keyword to look for.";
  if ((type === "tcp" || type === "ssl" || type === "dns") && !c.host) return "Enter a valid hostname or IP address.";
  if (type === "domain" && !c.domain) return "Enter a valid domain name.";
  return "";
}

export function normalizeChannelConfig<T extends ChannelType>(type: T, input: unknown): ChannelConfigByType[T] {
  const o = asObj(input);
  let out: unknown;
  switch (type) {
    case "email":
      out = {
        to: str(o.to, "", 1000)
          .split(/[,;\s]+/)
          .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
          .slice(0, 10)
          .join(", "),
      };
      break;
    case "webhook":
      out = { url: httpUrl(o.url), secret: str(o.secret, "", 200) };
      break;
    case "slack":
    case "discord":
    case "teams":
      out = { webhookUrl: httpUrl(o.webhookUrl) };
      break;
    case "telegram":
      out = { botToken: str(o.botToken, "", 100).replace(/[^A-Za-z0-9:_-]/g, ""), chatId: str(o.chatId, "", 40).replace(/[^0-9@A-Za-z_-]/g, "") };
      break;
  }
  return out as ChannelConfigByType[T];
}

export function channelProblem(type: ChannelType, config: unknown): string {
  const c = asObj(config);
  if (type === "email" && !c.to) return "Enter at least one valid email address.";
  if (type === "webhook" && !c.url) return "Enter the webhook URL (https://…).";
  if ((type === "slack" || type === "discord" || type === "teams") && !c.webhookUrl) return "Paste the incoming webhook URL.";
  if (type === "telegram" && (!c.botToken || !c.chatId)) return "Enter the bot token and the chat ID.";
  return "";
}

export function normalizeStatusPageSettings(input: unknown): StatusPageSettings {
  const o = asObj(input);
  const d = DEFAULT_STATUS_PAGE_SETTINGS;
  return {
    theme: oneOf(o.theme, ["light", "dark", "auto"] as const, d.theme),
    accent: typeof o.accent === "string" && /^#[0-9a-f]{6}$/i.test(o.accent) ? o.accent.toLowerCase() : "",
    historyDays: ([30, 60, 90] as const).includes(Number(o.historyDays) as 30 | 60 | 90) ? (Number(o.historyDays) as 30 | 60 | 90) : d.historyDays,
    showUptimePercent: bool(o.showUptimePercent, d.showUptimePercent),
    showResponseTimes: bool(o.showResponseTimes, d.showResponseTimes),
    allowSubscribe: bool(o.allowSubscribe, d.allowSubscribe),
    announcement: str(o.announcement, "", 300),
    websiteUrl: httpUrl(o.websiteUrl),
    noindex: bool(o.noindex, d.noindex),
  };
}

/** "my-status" style slug; "" when nothing usable is left. */
export function normalizeSlug(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function parseJson(text: string | null | undefined): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
