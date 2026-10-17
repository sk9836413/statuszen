import type { Metadata } from "next";
import Link from "next/link";
import { Crown, ExternalLink, PanelsTopLeft, Settings2 } from "lucide-react";
import { RefreshOnce } from "@/components/dashboard/actions";
import { NewStatusPageForm } from "@/components/dashboard/status-page-forms";
import { DashHeader, Empty, Panel } from "@/components/dashboard/ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireDashboardUser } from "@/lib/dashboard";
import { formatNumber } from "@/lib/dash-format";
import { countPageComponents, countSubscribers } from "@/lib/dashboard-data";
import { getLocale, getT } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/messages";
import { atLimit, getEntitlements } from "@/lib/plans";
import { baseUrl } from "@/lib/request";
import { uploadUrl } from "@/lib/site";
import { getUserStatusPages } from "@/lib/status-pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.nav.statusPages") };
}

export default async function StatusPagesPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = await requireDashboardUser();
  const [query, t, locale, entitlements, pages, base] = await Promise.all([searchParams, getT(), getLocale(), getEntitlements(user), getUserStatusPages(user.id), baseUrl()]);
  const ids = pages.map((p) => p.id);
  const [componentCounts, subscriberCounts] = await Promise.all([countPageComponents(ids), countSubscribers(ids)]);
  const full = atLimit(pages.length, entitlements.maxStatusPages);
  const prefix = `${base.replace(/^https?:\/\//, "")}/s/`;
  const num = (n: number) => formatNumber(n, locale.code);

  return (
    <>
      {query.deleted === "1" ? (
        <>
          <RefreshOnce cleanUrl="/dashboard/status-pages" />
          <Alert tone="success" className="mb-6">
            {t("dash.pages.deleted")}
          </Alert>
        </>
      ) : null}
      <DashHeader
        title={t("dash.nav.statusPages")}
        description={
          entitlements.maxStatusPages > 0 ? t("dash.pages.subtitleLimit", { used: pages.length, limit: entitlements.maxStatusPages }) : t("dash.pages.subtitle")
        }
      />

      {full ? (
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-primary-soft p-5">
          <Crown className="size-5 shrink-0 text-amber-500" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">{plural(t, "dash.err.pageLimit", entitlements.maxStatusPages, { limit: entitlements.maxStatusPages })}</p>
          <ButtonLink href="/pricing" size="sm">
            {t("dash.usage.upgradeCta")}
          </ButtonLink>
        </div>
      ) : (
        <Panel title={t("dash.pages.new")} description={t("dash.pages.newText")} className="mb-6">
          <NewStatusPageForm prefix={prefix} />
        </Panel>
      )}

      {pages.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {pages.map((p) => {
            const logo = uploadUrl(p.logo);
            const url = `${base}/s/${p.slug}`;
            return (
              <li key={p.id} className="flex flex-col rounded-xl border border-line bg-surface p-5">
                <div className="flex items-start gap-3">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo of unknown size
                    <img src={logo} alt="" className="size-10 shrink-0 rounded-lg border border-line object-contain p-1" />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                      <PanelsTopLeft className="size-5" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/dashboard/status-pages/${p.id}`} dir="auto" className="truncate font-semibold hover:text-primary">
                        {p.name}
                      </Link>
                      {p.isPublic ? <Badge tone="success">{t("dash.pages.live")}</Badge> : <Badge>{t("dash.pages.private")}</Badge>}
                    </div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-sm text-muted hover:text-primary" dir="ltr">
                      {url.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted">{t("dash.pages.components")}</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums">{num(componentCounts.get(p.id) ?? 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("dash.pages.subscribers")}</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums">{num(subscriberCounts.get(p.id) ?? 0)}</dd>
                  </div>
                </dl>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                  <ButtonLink href={`/dashboard/status-pages/${p.id}`} size="sm">
                    <Settings2 aria-hidden />
                    {t("dash.pages.manage")}
                  </ButtonLink>
                  <ButtonLink href={url} target="_blank" rel="noopener noreferrer" variant="outline" size="sm">
                    <ExternalLink aria-hidden />
                    {t("dash.pages.open")}
                  </ButtonLink>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Panel>
          <Empty icon={<PanelsTopLeft />} title={t("dash.pages.emptyTitle")}>
            {t("dash.pages.emptyText")}
          </Empty>
        </Panel>
      )}
    </>
  );
}
