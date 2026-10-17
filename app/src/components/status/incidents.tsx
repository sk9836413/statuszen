import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { interpolateParts, type Translator } from "@/lib/i18n/messages";
import type { PublicIncident } from "@/lib/status-view";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/monitor/format";
import { IMPACT_STATE, STATE_TONE } from "./state";
import { Time } from "./time";

export function incidentTone(incident: PublicIncident) {
  return STATE_TONE[incident.kind === "maintenance" ? "maintenance" : IMPACT_STATE[incident.impact]];
}

export function StatusChip({ incident, t }: { incident: PublicIncident; t: Translator }) {
  const resolved = incident.status === "resolved" || incident.status === "completed";
  const tone = incidentTone(incident);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        resolved ? "border-line bg-paper text-muted" : cn(tone.panel, tone.text),
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", resolved ? "bg-emerald-500" : tone.solid)} />
      {t(`status.incident.${incident.status}`)}
    </span>
  );
}

function affects(incident: PublicIncident, names: Map<number, string>, t: Translator): string | null {
  const list = incident.monitorIds.map((id) => names.get(id)).filter(Boolean);
  return list.length ? t("status.affects", { list: list.join(", ") }) : null;
}

/** Message text from the incident's author: plain text, line breaks kept. */
export function Message({ text, className }: { text: string; className?: string }) {
  return <p className={cn("break-words whitespace-pre-line", className)}>{text}</p>;
}

/** Card for an open incident or a maintenance window, with its latest updates. */
export function IncidentCard({
  incident,
  href,
  names,
  t,
  locale,
  upcoming = false,
}: {
  incident: PublicIncident;
  href: string;
  names: Map<number, string>;
  t: Translator;
  locale: string;
  upcoming?: boolean;
}) {
  const maintenance = incident.kind === "maintenance";
  const tone = incidentTone(incident);
  const Icon = maintenance ? CalendarClock : tone.icon;
  const affected = affects(incident, names, t);
  const updates = incident.updates.slice(0, 3);
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <header className={cn("flex items-start gap-3 border-b px-5 py-4", tone.panel)}>
        <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-white", tone.solid)}>
          <Icon className="size-[18px]" aria-hidden strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-semibold uppercase tracking-wide", tone.text)}>
            {maintenance ? t(upcoming ? "status.maintenanceUpcoming" : "status.maintenanceNow") : t(`status.impact.${incident.impact}`)}
          </p>
          <h3 className="mt-0.5 font-display text-lg leading-snug font-semibold text-ink">
            <Link href={href} className="hover:underline hover:underline-offset-4">
              {incident.title}
            </Link>
          </h3>
          {maintenance && incident.scheduledStart ? (
            <p className="mt-1 text-sm text-muted">
              {incident.scheduledEnd ? (
                interpolateParts(t("status.window"), {
                  start: <Time key="s" iso={incident.scheduledStart} locale={locale} />,
                  end: <Time key="e" iso={incident.scheduledEnd} locale={locale} />,
                })
              ) : (
                <Time iso={incident.scheduledStart} locale={locale} />
              )}
            </p>
          ) : null}
          {affected ? <p className="mt-1 text-sm text-muted">{affected}</p> : null}
        </div>
      </header>
      {updates.length ? (
        <ol className="divide-y divide-line">
          {updates.map((u) => (
            <li key={u.id} className="px-5 py-3.5">
              <p className="text-sm leading-relaxed text-ink">
                <strong className="font-semibold">{t(`status.incident.${u.status}`)}</strong>
                <span className="text-muted"> — </span>
                <span className="break-words whitespace-pre-line">{u.message}</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                <Time iso={u.createdAt} locale={locale} />
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-5 py-3.5 text-sm text-muted">
          <StatusChip incident={incident} t={t} /> <Time iso={incident.startedAt} locale={locale} className="ms-2" />
        </p>
      )}
    </article>
  );
}

/** Seconds between start and resolution (or now). */
export function incidentSeconds(incident: PublicIncident): number {
  const end = incident.resolvedAt ? Date.parse(incident.resolvedAt) : Date.now();
  return Math.max(0, (end - Date.parse(incident.scheduledStart ?? incident.startedAt)) / 1000);
}

/** One line in the past-incidents and history lists. */
export function IncidentRow({ incident, href, t, locale }: { incident: PublicIncident; href: string; t: Translator; locale: string }) {
  const tone = incidentTone(incident);
  const latest = incident.updates[0];
  const resolved = Boolean(incident.resolvedAt);
  const duration = formatDuration(incidentSeconds(incident), t);
  return (
    <li className="group relative py-3.5">
      <div className="flex items-start gap-3">
        <span aria-hidden className={cn("mt-[0.55rem] size-2 shrink-0 rounded-full", resolved ? "bg-slate-300 dark:bg-slate-600" : tone.solid)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={href} className={cn("font-semibold leading-snug hover:underline hover:underline-offset-4", resolved ? "text-ink" : tone.text)}>
              {incident.title}
            </Link>
            <StatusChip incident={incident} t={t} />
          </div>
          {latest ? <Message text={latest.message} className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted" /> : null}
          <p className="mt-1.5 text-xs text-muted">
            <Time iso={incident.scheduledStart ?? incident.startedAt} locale={locale} />
            <span aria-hidden> · </span>
            {resolved
              ? incident.kind === "maintenance"
                ? t("status.lasted", { duration })
                : t("status.resolvedIn", { duration })
              : t("status.ongoingFor", { duration })}
          </p>
        </div>
      </div>
    </li>
  );
}
