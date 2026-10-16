/** Translator shape accepted by these helpers (server getT() and client useT() both fit). */
type T = (key: "time.seconds" | "time.minutes" | "time.hours" | "time.days", vars: { n: number }) => string;

/** 30 → "30 sec", 300 → "5 min", 3600 → "1 h", 86400 → "1 day" (localised through `t`). */
export function formatInterval(seconds: number, t: T): string {
  if (seconds >= 86_400 && seconds % 86_400 === 0) return t("time.days", { n: seconds / 86_400 });
  if (seconds >= 3_600 && seconds % 3_600 === 0) return t("time.hours", { n: seconds / 3_600 });
  if (seconds >= 60 && seconds % 60 === 0) return t("time.minutes", { n: seconds / 60 });
  return t("time.seconds", { n: seconds });
}

/** 3725 → "1 h 2 min", 45 → "45 sec" — for downtime durations. */
export function formatDuration(seconds: number, t: T): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return t("time.seconds", { n: s });
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3_600);
  const m = Math.floor((s % 3_600) / 60);
  const parts: string[] = [];
  if (d) parts.push(t("time.days", { n: d }));
  if (h) parts.push(t("time.hours", { n: h }));
  if (m && !d) parts.push(t("time.minutes", { n: m }));
  return parts.join(" ");
}
