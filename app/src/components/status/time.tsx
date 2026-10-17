/**
 * Times are rendered in UTC on the server and switched to the visitor's own time
 * zone in the browser by <LocalTimes /> (see local-times.tsx).
 */

import { TIME_FORMATS } from "./format";

export type TimeFormat = keyof typeof TIME_FORMATS;

export function formatUtc(iso: string, locale: string, format: TimeFormat = "datetime"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, { ...TIME_FORMATS[format], timeZone: "UTC" }).format(d);
  } catch {
    return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  }
}

export function Time({ iso, locale, format = "datetime", className }: { iso: string; locale: string; format?: TimeFormat; className?: string }) {
  return (
    <time dateTime={iso} data-sz-time={format} className={className} suppressHydrationWarning>
      {formatUtc(iso, locale, format)}
    </time>
  );
}
