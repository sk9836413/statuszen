import type { AlertEvent, AlertPayload, IncidentStatus } from "@/monitor/types";

/** 3725 → "1 h 2 min", 45 → "45 sec" (English: alerts aren't localised). */
export function humanDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  if (s < 60) return `${s} sec`;
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3_600);
  const m = Math.floor((s % 3_600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d} day${d === 1 ? "" : "s"}`);
  if (h) parts.push(`${h} h`);
  if (m && !d) parts.push(`${m} min`);
  return parts.join(" ");
}

/** "2026-10-16 14:05 UTC" */
export function humanTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return `${new Date(t).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((t - Date.now()) / 86_400_000));
}

export const EVENT_COLORS: Record<AlertEvent, string> = {
  down: "#dc2626",
  up: "#16a34a",
  reminder: "#ea580c",
  ssl_expiring: "#d97706",
  domain_expiring: "#d97706",
  test: "#1d5bd8",
};

const SUBJECT_PREFIX: Record<AlertEvent, string> = {
  down: "Down",
  up: "Up",
  reminder: "Still down",
  ssl_expiring: "SSL expiring",
  domain_expiring: "Domain expiring",
  test: "Test",
};

export interface AlertText {
  /** One-line headline, e.g. "Website is down". */
  title: string;
  /** Email subject, e.g. "[Down] Website". */
  subject: string;
  /** One or two sentences with the essentials. */
  summary: string;
  /** Label/value pairs shown as fields. */
  facts: Array<[string, string]>;
  color: string;
}

export function describeAlert(p: AlertPayload, siteName: string): AlertText {
  const name = p.monitor.name;
  const days = daysUntil(p.expiresAt);
  const dayText = days === null ? "soon" : days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`;
  let title: string;
  let summary: string;
  switch (p.event) {
    case "down":
      title = `${name} is down`;
      summary = p.error ? `Reason: ${p.error}` : "The monitor is not responding.";
      break;
    case "up":
      title = `${name} is up again`;
      summary = p.downtimeSec != null ? `It was down for ${humanDuration(p.downtimeSec)}.` : "The monitor is responding again.";
      break;
    case "reminder":
      title = `${name} is still down`;
      summary = `Down for ${humanDuration(p.downSince ? (Date.now() - Date.parse(p.downSince)) / 1000 : 0)}.${p.error ? ` Reason: ${p.error}` : ""}`;
      break;
    case "ssl_expiring":
      title = `SSL certificate for ${p.monitor.target} expires ${dayText}`;
      summary = `The certificate expires on ${humanTime(p.expiresAt)}. Renew it to avoid browser warnings.`;
      break;
    case "domain_expiring":
      title = `Domain ${p.monitor.target} expires ${dayText}`;
      summary = `The registration expires on ${humanTime(p.expiresAt)}. Renew it with your registrar.`;
      break;
    case "test":
      title = `Test alert from ${siteName}`;
      summary = "If you can read this, alerts to this channel work.";
      break;
  }
  const facts: Array<[string, string]> = [
    ["Monitor", name],
    ["Target", p.monitor.target || p.monitor.type],
  ];
  if (p.downSince && p.event !== "test") facts.push(["Down since", humanTime(p.downSince)]);
  if (p.event === "up" && p.downtimeSec != null) facts.push(["Downtime", humanDuration(p.downtimeSec)]);
  if (p.responseMs != null && p.event === "up") facts.push(["Response time", `${p.responseMs} ms`]);
  if (p.expiresAt) facts.push(["Expires", humanTime(p.expiresAt)]);
  return { title, subject: `[${SUBJECT_PREFIX[p.event]}] ${p.event === "test" ? siteName : name}`, summary, facts, color: EVENT_COLORS[p.event] };
}

/** Plain-text body used by email (and as a fallback elsewhere). */
export function alertPlainText(p: AlertPayload, siteName: string): string {
  const t = describeAlert(p, siteName);
  return [
    t.title,
    "",
    t.summary,
    "",
    ...t.facts.map(([k, v]) => `${k}: ${v}`),
    "",
    `Open the monitor: ${p.url}`,
    "",
    `— ${siteName}`,
  ].join("\n");
}

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  scheduled: "Scheduled maintenance",
  in_progress: "Maintenance in progress",
  completed: "Maintenance completed",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export interface SendContext {
  siteName: string;
  /** Admin → allow private targets: webhooks may point at internal addresses. */
  allowPrivate: boolean;
  timeoutMs: number;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}
