/** Formatting helpers for the public status pages (server and client safe, no imports). */

/** 99.987 → "99.98%" (never rounds up to 100%), 100 → "100%", null → "–". */
export function formatPercent(value: number | null | undefined, locale = "en"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  const floored = value >= 100 ? 100 : Math.floor(value * 100) / 100;
  try {
    return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: floored === 100 ? 0 : 2, maximumFractionDigits: 2 }).format(floored / 100);
  } catch {
    return `${floored}%`;
  }
}

/** Time formats shared by the server (UTC) and the browser (visitor's zone). dateStyle can't be combined with timeZoneName. */
export const TIME_FORMATS: Record<"datetime" | "time" | "date", Intl.DateTimeFormatOptions> = {
  datetime: { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" },
  time: { hour: "numeric", minute: "2-digit", timeZoneName: "short" },
  date: { year: "numeric", month: "short", day: "numeric" },
};

/** Uptime bar colour: green ≥ 99.9, lime ≥ 99, amber ≥ 95, red below, gray without data. */
export function barTone(uptime: number | null): "great" | "good" | "warn" | "bad" | "none" {
  if (uptime === null) return "none";
  if (uptime >= 99.9) return "great";
  if (uptime >= 99) return "good";
  if (uptime >= 95) return "warn";
  return "bad";
}

export const BAR_CLASS: Record<ReturnType<typeof barTone>, string> = {
  great: "bg-emerald-500",
  good: "bg-lime-500",
  warn: "bg-amber-400",
  bad: "bg-red-500",
  none: "bg-slate-200 dark:bg-slate-700/70",
};

/** "2026-10-16" → "Oct 16, 2026" in `locale` (days are UTC calendar days). */
export function formatDay(day: string, locale: string, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  const d = new Date(`${day}T00:00:00Z`);
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(d);
  } catch {
    return day;
  }
}

/** The last `n` UTC calendar days, today first ("2026-10-17", "2026-10-16", …). */
export function lastDays(n: number): string[] {
  const nowMs = Date.now();
  return Array.from({ length: n }, (_, i) => new Date(nowMs - i * 86_400_000).toISOString().slice(0, 10));
}

/** Seconds → "1 h 5 min" using unit templates like "{n} min". */
export function formatSeconds(seconds: number, units: { s: string; m: string; h: string; d: string }): string {
  const fill = (tpl: string, n: number) => tpl.replace("{n}", String(n));
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return fill(units.s, s);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3_600);
  const m = Math.floor((s % 3_600) / 60);
  const parts: string[] = [];
  if (d) parts.push(fill(units.d, d));
  if (h) parts.push(fill(units.h, h));
  if (m && !d) parts.push(fill(units.m, m));
  return parts.join(" ");
}
