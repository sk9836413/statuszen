import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Translator } from "@/lib/i18n/messages";
import type { PublicIncident } from "@/lib/status-view";
import type { OverallStatus } from "@/monitor/types";
import { cn } from "@/lib/utils";
import { formatDay, lastDays } from "./format";
import { IncidentRow } from "./incidents";
import { STATE_TONE } from "./state";

/** Big banner at the top: "All systems operational" etc. */
export function OverallBanner({ status, t }: { status: OverallStatus; t: Translator }) {
  const tone = STATE_TONE[status];
  const Icon = tone.icon;
  const ok = status === "operational";
  return (
    <section aria-live="polite" className={cn("relative overflow-hidden rounded-3xl border px-6 py-7 sm:px-8 sm:py-8", tone.panel)}>
      <div className="flex items-center gap-4 sm:gap-5">
        <span className="relative grid size-12 shrink-0 place-items-center sm:size-14">
          {!ok ? <span aria-hidden className={cn("absolute inset-0 animate-ping rounded-full opacity-30 motion-reduce:animate-none", tone.solid)} /> : null}
          <span className={cn("relative grid size-12 place-items-center rounded-full text-white shadow-sm ring-8 sm:size-14", tone.solid, tone.ring)}>
            <Icon className="size-6 sm:size-7" aria-hidden strokeWidth={2.25} />
          </span>
        </span>
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight font-semibold tracking-tight text-ink sm:text-[1.75rem]">{t(`status.overall.${status}`)}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted sm:text-[0.9375rem]">{t(`status.overallText.${status}`)}</p>
        </div>
      </div>
    </section>
  );
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{children}</h2>
      {aside}
    </div>
  );
}

type Segment = { kind: "day"; day: string; incidents: PublicIncident[] } | { kind: "quiet"; from: string; to: string };

/** Past incidents for the last `days` days, newest first; quiet stretches are collapsed into one line. */
export function PastIncidents({
  incidents,
  days,
  slug,
  t,
  locale,
}: {
  incidents: PublicIncident[];
  days: number;
  slug: string;
  t: Translator;
  locale: string;
}) {
  const byDay = new Map<string, PublicIncident[]>();
  for (const i of incidents) {
    const day = (i.scheduledStart ?? i.startedAt).slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), i]);
  }
  const segments: Segment[] = [];
  lastDays(days).forEach((day, n) => {
    const list = byDay.get(day);
    if (list?.length || n === 0) {
      segments.push({ kind: "day", day, incidents: list ?? [] });
      return;
    }
    const last = segments[segments.length - 1];
    if (last?.kind === "quiet") last.from = day;
    else segments.push({ kind: "quiet", from: day, to: day });
  });

  const range = (from: string, to: string) => {
    if (from === to) return formatDay(from, locale, { dateStyle: "long" });
    try {
      return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).formatRange(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`));
    } catch {
      return `${formatDay(from, locale)} – ${formatDay(to, locale)}`;
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface px-5 sm:px-6">
      {segments.map((seg) =>
        seg.kind === "day" ? (
          <div key={seg.day} className="border-b border-line py-4 last:border-b-0">
            <h3 className="text-sm font-semibold text-ink">{formatDay(seg.day, locale, { dateStyle: "long" })}</h3>
            {seg.incidents.length ? (
              <ul className="-mb-2 divide-y divide-line/70">
                {seg.incidents.map((i) => (
                  <IncidentRow key={i.id} incident={i} href={`/s/${slug}/incidents/${i.id}`} t={t} locale={locale} />
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted">{t("status.quietDay")}</p>
            )}
          </div>
        ) : (
          <div key={seg.from} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-3.5 text-sm last:border-b-0">
            <span className="font-medium text-ink/80">{range(seg.from, seg.to)}</span>
            <span className="text-muted">{t("status.quietDay")}</span>
          </div>
        ),
      )}
    </div>
  );
}

export function HistoryLink({ slug, t }: { slug: string; t: Translator }) {
  return (
    <Link href={`/s/${slug}/history`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-text hover:underline hover:underline-offset-4">
      {t("status.historyLink")}
      <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
    </Link>
  );
}
