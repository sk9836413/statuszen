import "server-only";
import crypto from "node:crypto";
import type { MonitorStatus, OverallStatus } from "@/monitor/types";

/**
 * shields.io-style SVG badges for /badge/{slug}.svg and /badge/m/{key}.svg.
 */

export type BadgeStyle = "flat" | "flat-square";

export const BADGE_COLORS = {
  green: "#4c1",
  lime: "#97ca00",
  yellow: "#dfb317",
  orange: "#fe7d37",
  red: "#e05d44",
  blue: "#007ec6",
  gray: "#9f9f9f",
} as const;

export const OVERALL_BADGE: Record<OverallStatus, { text: string; color: string }> = {
  operational: { text: "operational", color: BADGE_COLORS.green },
  degraded: { text: "degraded", color: BADGE_COLORS.yellow },
  partial_outage: { text: "partial outage", color: BADGE_COLORS.orange },
  major_outage: { text: "major outage", color: BADGE_COLORS.red },
  maintenance: { text: "maintenance", color: BADGE_COLORS.blue },
};

export const MONITOR_BADGE: Record<MonitorStatus, { text: string; color: string }> = {
  up: { text: "up", color: BADGE_COLORS.green },
  down: { text: "down", color: BADGE_COLORS.red },
  maintenance: { text: "maintenance", color: BADGE_COLORS.blue },
  paused: { text: "paused", color: BADGE_COLORS.gray },
  pending: { text: "pending", color: BADGE_COLORS.gray },
};

export function uptimeColor(uptime: number | null): string {
  if (uptime === null) return BADGE_COLORS.gray;
  if (uptime >= 99.9) return BADGE_COLORS.green;
  if (uptime >= 99) return BADGE_COLORS.lime;
  if (uptime >= 95) return BADGE_COLORS.yellow;
  if (uptime >= 90) return BADGE_COLORS.orange;
  return BADGE_COLORS.red;
}

/** 99.987 → "99.98%" (never rounds up to 100%). */
export function uptimeText(uptime: number | null): string {
  if (uptime === null) return "no data";
  if (uptime >= 100) return "100%";
  return `${(Math.floor(uptime * 100) / 100).toFixed(2)}%`;
}

// Verdana 11px advance widths for printable ASCII (32–126), as used by shields.io.
const WIDTHS = [
  3.87, 4.33, 5.05, 9, 6.99, 11.84, 7.99, 2.95, 4.99, 4.99, 6.99, 9, 4, 4.99, 4, 4.99, 6.99, 6.99, 6.99, 6.99, 6.99, 6.99, 6.99, 6.99, 6.99, 6.99, 4.99,
  4.99, 9, 9, 9, 6, 11, 7.52, 7.54, 7.68, 8.48, 6.96, 6.32, 8.53, 8.27, 4.63, 5, 7.62, 6.12, 9.27, 8.23, 8.66, 6.63, 8.66, 7.65, 7.52, 6.78, 8.05, 7.52,
  10.88, 7.54, 6.77, 7.54, 4.99, 4.99, 4.99, 9, 6.99, 6.99, 6.61, 6.85, 5.73, 6.85, 6.55, 3.87, 6.85, 6.96, 3.02, 3.79, 6.51, 3.02, 10.71, 6.96, 6.67,
  6.85, 6.85, 4.69, 5.73, 4.33, 6.96, 6.51, 8.98, 6.51, 6.51, 5.77, 6.98, 4.99, 6.98, 9,
];

/** Estimated rendered width of `text` in Verdana 11px. */
export function textWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 32 && code <= 126) width += WIDTHS[code - 32];
    else if (code >= 0x2e80) width += 11; // CJK and other wide scripts
    else width += 7;
  }
  return width;
}

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Strip control characters and limit the length of user-supplied badge text. */
export function cleanBadgeText(s: string, max = 40): string {
  return Array.from(s.replace(/[\x00-\x1f\x7f]/g, "").trim()).slice(0, max).join("");
}

function darkText(hex: string): boolean {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 255_000 > 0.69;
}

export function renderBadge({ label, value, color, style = "flat" }: { label: string; value: string; color: string; style?: BadgeStyle }): string {
  const lw = Math.round(textWidth(label) + 10);
  const vw = Math.round(textWidth(value) + 10);
  const w = lw + vw;
  const flat = style === "flat";
  const title = escapeXml(`${label}: ${value}`);
  const fg = darkText(color) ? "#333" : "#fff";
  const shadow = darkText(color) ? "#ccc" : "#010101";
  const text = (t: string, centerX: number, width: number, fill: string, shadowFill: string) => {
    const x = Math.round(centerX * 10);
    const len = Math.round((width - 10) * 10);
    const shadowText = flat ? `<text aria-hidden="true" x="${x}" y="150" fill="${shadowFill}" fill-opacity=".3" transform="scale(.1)" textLength="${len}">${escapeXml(t)}</text>` : "";
    return `${shadowText}<text x="${x}" y="140" transform="scale(.1)" fill="${fill}" textLength="${len}">${escapeXml(t)}</text>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${title}"><title>${title}</title>${
    flat
      ? `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>`
      : ""
  }<g${flat ? ' clip-path="url(#r)"' : ""} shape-rendering="crispEdges"><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${vw}" height="20" fill="${escapeXml(color)}"/>${
    flat ? `<rect width="${w}" height="20" fill="url(#s)"/>` : ""
  }</g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">${text(label, lw / 2, lw, "#fff", "#010101")}${text(value, lw + vw / 2, vw, fg, shadow)}</g></svg>`;
}

export function badgeResponse(svg: string, status = 200): Response {
  return new Response(svg, {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
      // Badges are images: never let them run scripts if opened directly.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

/** Query options shared by both badge routes. */
export function badgeOptions(url: string): { style: BadgeStyle; label: string | null } {
  const q = new URL(url).searchParams;
  const label = q.get("label");
  return {
    style: q.get("style") === "flat-square" ? "flat-square" : "flat",
    label: label !== null && cleanBadgeText(label) ? cleanBadgeText(label) : null,
  };
}

/**
 * Public key for a monitor's badge URL: "{id}-{signature}". The signature is derived
 * from the monitor's secret heartbeat token, so the badge URL can be published
 * (READMEs, websites) without exposing the heartbeat ping URL.
 */
export function monitorBadgeKey(monitor: { id: number; heartbeatToken: string }): string {
  const sig = crypto.createHmac("sha256", monitor.heartbeatToken).update(`badge:${monitor.id}`).digest("hex").slice(0, 16);
  return `${monitor.id}-${sig}`;
}

/** "12-abcdef0123456789(.svg)" → monitor id, or null when malformed. Verify with monitorBadgeKey(). */
export function parseMonitorBadgeKey(key: string): number | null {
  const m = /^(\d{1,10})-([a-f0-9]{16})(?:\.svg)?$/.exec(key);
  return m ? Number(m[1]) : null;
}
