import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { incidentSeconds, incidentTone, Message, StatusChip } from "@/components/status/incidents";
import { Time } from "@/components/status/time";
import { getLocale, getT } from "@/lib/i18n/server";
import { getPageIncident, getPageMonitors, getViewablePage } from "@/lib/status-view";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/monitor/format";

type Props = { params: Promise<{ slug: string; id: string }> };

async function load({ params }: Props) {
  const { slug, id } = await params;
  const found = await getViewablePage(slug);
  if (!found) return null;
  const monitors = await getPageMonitors(found.page);
  const incident = await getPageIncident(
    found.page,
    monitors.map((m) => m.monitor.id),
    Number(id),
  );
  return incident ? { page: found.page, incident, names: new Map(monitors.map((m) => [m.monitor.id, m.name])) } : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const data = await load(props);
  return data ? { title: data.incident.title, description: data.incident.updates[0]?.message.slice(0, 160) } : {};
}

export default async function IncidentPage(props: Props) {
  const data = await load(props);
  if (!data) notFound();
  const { page, incident, names } = data;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const tone = incidentTone(incident);
  const maintenance = incident.kind === "maintenance";
  const affected = incident.monitorIds.map((id) => names.get(id)).filter((n): n is string => Boolean(n));
  const duration = formatDuration(incidentSeconds(incident), t);
  const upcoming = maintenance && incident.status === "scheduled" && (incident.scheduledStart ?? incident.startedAt) > new Date().toISOString();

  return (
    <main className="mx-auto max-w-3xl px-5 pt-2 pb-8">
      <Link href={`/s/${page.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t("status.backToStatus")}
      </Link>

      <article className="mt-5 overflow-hidden rounded-3xl border border-line bg-surface">
        <header className={cn("border-b px-6 py-6 sm:px-8", tone.panel)}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip incident={incident} t={t} />
            <span className={cn("text-xs font-semibold uppercase tracking-wide", tone.text)}>
              {maintenance ? t(upcoming ? "status.maintenanceUpcoming" : "status.impact.maintenance") : t(`status.impact.${incident.impact}`)}
            </span>
          </div>
          <h1 dir="auto" className="mt-3 font-display text-2xl leading-tight font-semibold tracking-tight text-ink sm:text-3xl">{incident.title}</h1>
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
                            <p className="text-muted">
                <Time iso={incident.scheduledStart ?? incident.startedAt} locale={locale.code} />
                {incident.scheduledEnd && maintenance ? (
                  <>
                    {" → "}
                    <Time iso={incident.scheduledEnd} locale={locale.code} />
                  </>
                ) : null}
              </p>
            </div>
            {!upcoming ? (
              <div>
                                <p className="font-medium text-ink">
                  {incident.resolvedAt
                    ? maintenance
                      ? t("status.lasted", { duration })
                      : t("status.resolvedIn", { duration })
                    : t("status.ongoingFor", { duration })}
                </p>
              </div>
            ) : null}
          </div>
          {affected.length ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("status.affectedComponents")}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {affected.map((name) => (
                  <li key={name} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </header>

        <section className="px-6 py-6 sm:px-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("status.updates")}</h2>
          {incident.updates.length ? (
            <ol className="relative mt-4 space-y-6 border-s border-line ps-6">
              {incident.updates.map((u, i) => (
                <li key={u.id} className="relative">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -start-[1.85rem] top-1 size-3 rounded-full ring-4 ring-surface",
                      i === 0 && !incident.resolvedAt ? tone.solid : u.status === "resolved" || u.status === "completed" ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600",
                    )}
                  />
                  <p className="text-sm font-semibold text-ink">{t(`status.incident.${u.status}`)}</p>
                  <Message text={u.message} className="mt-1 text-[0.9375rem] leading-relaxed text-ink/90" />
                  <p className="mt-1.5 text-xs text-muted">
                    <Time iso={u.createdAt} locale={locale.code} />
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted">
              <Time iso={incident.startedAt} locale={locale.code} />
            </p>
          )}
        </section>
      </article>
    </main>
  );
}
