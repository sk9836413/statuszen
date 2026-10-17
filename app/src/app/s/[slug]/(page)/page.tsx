import { notFound } from "next/navigation";
import { ComponentsList } from "@/components/status/components-list";
import { IncidentCard } from "@/components/status/incidents";
import { HistoryLink, OverallBanner, PastIncidents, SectionTitle } from "@/components/status/sections";
import { getLocale, getT } from "@/lib/i18n/server";
import { maybeLazyTick } from "@/lib/lazy-tick";
import { getRecentIncidents, getViewablePage, loadStatusView } from "@/lib/status-view";

const PAST_DAYS = 14;

export default async function StatusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getViewablePage(slug);
  if (!found) notFound();
  const { page } = found;
  maybeLazyTick();

  const [t, locale, view] = await Promise.all([getT(), getLocale(), loadStatusView(page)]);
  const past = await getRecentIncidents(page, view.monitorIds, PAST_DAYS);
  const names = new Map(view.components.map((c) => [c.monitorId, c.name]));
  const href = (id: number) => `/s/${page.slug}/incidents/${id}`;
  const s = page.settings;

  return (
    <main className="mx-auto max-w-3xl space-y-10 px-5 pt-2 pb-8">
      <h1 className="sr-only">{t("status.metaTitle", { name: page.name })}</h1>
      <div>
        {page.description ? <p dir="auto" className="mb-5 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">{page.description}</p> : null}
        <OverallBanner status={view.overall} t={t} />
      </div>

      {view.active.length || view.maintenanceNow.length ? (
        <section className="space-y-4" aria-label={t(`status.overall.${view.overall}`)}>
          {view.active.map((i) => (
            <IncidentCard key={i.id} incident={i} href={href(i.id)} names={names} t={t} locale={locale.code} />
          ))}
          {view.maintenanceNow.map((i) => (
            <IncidentCard key={i.id} incident={i} href={href(i.id)} names={names} t={t} locale={locale.code} />
          ))}
        </section>
      ) : null}

      <section>
        <SectionTitle>{t("status.systemStatus")}</SectionTitle>
        {view.components.length ? (
          <ComponentsList components={view.components} t={t} locale={locale.code} days={s.historyDays} showUptime={s.showUptimePercent} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-sm text-muted">{t("status.noComponents")}</p>
        )}
      </section>

      {view.maintenanceUpcoming.length ? (
        <section>
          <SectionTitle>{t("status.maintenanceUpcoming")}</SectionTitle>
          <div className="space-y-4">
            {view.maintenanceUpcoming.map((i) => (
              <IncidentCard key={i.id} incident={i} href={href(i.id)} names={names} t={t} locale={locale.code} upcoming />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionTitle aside={<HistoryLink slug={page.slug} t={t} />}>{t("status.pastIncidents")}</SectionTitle>
        <PastIncidents incidents={past} days={PAST_DAYS} slug={page.slug} t={t} locale={locale.code} />
      </section>
    </main>
  );
}
