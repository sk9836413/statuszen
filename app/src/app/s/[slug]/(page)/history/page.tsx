import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { IncidentRow } from "@/components/status/incidents";
import { getLocale, getT } from "@/lib/i18n/server";
import { getIncidentsBetween, getOldestIncidentStart, getPageMonitors, getViewablePage } from "@/lib/status-view";

const MONTHS_PER_PAGE = 3;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("status.history") };
}

/** First day of the month `offset` months before the current one (UTC). */
function monthStart(offset: number): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - offset, 1));
}

export default async function HistoryPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const found = await getViewablePage(slug);
  if (!found) notFound();
  const { page } = found;
  const pageNo = Math.min(500, Math.max(0, Math.floor(Number(query.page) || 0)));
  const [t, locale, monitors] = await Promise.all([getT(), getLocale(), getPageMonitors(page)]);
  const ids = monitors.map((m) => m.monitor.id);

  const first = pageNo * MONTHS_PER_PAGE;
  const months = Array.from({ length: MONTHS_PER_PAGE }, (_, i) => first + i);
  const from = monthStart(first + MONTHS_PER_PAGE - 1).toISOString();
  const to = monthStart(first - 1).toISOString();
  const [incidents, oldest] = await Promise.all([getIncidentsBetween(page, ids, from, to, 1000), getOldestIncidentStart(page, ids)]);
  const hasOlder = Boolean(oldest && oldest < from);

  const monthName = new Intl.DateTimeFormat(locale.code, { month: "long", year: "numeric", timeZone: "UTC" });
  const base = `/s/${page.slug}/history`;
  const linkClass =
    "inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-primary-line hover:text-primary-text";

  return (
    <main className="mx-auto max-w-3xl px-5 pt-2 pb-8">
      <Link href={`/s/${page.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t("status.backToStatus")}
      </Link>
      <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink">{t("status.history")}</h1>
      <p className="mt-2 text-muted">{t("status.historyText", { name: page.name })}</p>

      <div className="mt-8 space-y-8">
        {months.map((offset) => {
          const start = monthStart(offset).toISOString();
          const end = monthStart(offset - 1).toISOString();
          const list = incidents.filter((i) => {
            const at = i.scheduledStart ?? i.startedAt;
            return at >= start && at < end;
          });
          return (
            <section key={offset}>
              <h2 className="mb-3 font-display text-lg font-semibold text-ink">{monthName.format(new Date(start))}</h2>
              <div className="rounded-2xl border border-line bg-surface px-5 sm:px-6">
                {list.length ? (
                  <ul className="divide-y divide-line">
                    {list.map((i) => (
                      <IncidentRow key={i.id} incident={i} href={`/s/${page.slug}/incidents/${i.id}`} t={t} locale={locale.code} />
                    ))}
                  </ul>
                ) : (
                  <p className="py-5 text-sm text-muted">{t("status.noIncidentsMonth")}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {pageNo > 0 || hasOlder ? (
        <nav className="mt-8 flex items-center justify-between gap-4">
          {pageNo > 0 ? (
            <Link href={pageNo === 1 ? base : `${base}?page=${pageNo - 1}`} className={linkClass}>
              <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
              {t("status.newer")}
            </Link>
          ) : (
            <span />
          )}
          {hasOlder ? (
            <Link href={`${base}?page=${pageNo + 1}`} className={linkClass}>
              {t("status.older")}
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
