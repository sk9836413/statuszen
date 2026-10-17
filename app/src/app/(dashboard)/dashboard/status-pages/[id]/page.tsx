import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, Mail, Trash } from "lucide-react";
import { deleteStatusPageAction, removeSubscriberAction } from "@/app/actions/dashboard/status-pages";
import { ActionButton, RefreshOnce } from "@/components/dashboard/actions";
import { CopyField } from "@/components/dashboard/copy";
import { StatusPageBuilder } from "@/components/dashboard/status-page-forms";
import { Empty, Panel } from "@/components/dashboard/ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireDashboardUser } from "@/lib/dashboard";
import { formatDateTime, formatNumber } from "@/lib/dash-format";
import { getSubscribers, getUserMonitorsCached } from "@/lib/dashboard-data";
import { effectiveStatus } from "@/lib/dashboard-view";
import { getLocale, getT } from "@/lib/i18n/server";
import { baseUrl } from "@/lib/request";
import { uploadUrl } from "@/lib/site";
import { getOwnedStatusPage, getPageComponents } from "@/lib/status-pages";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await requireDashboardUser();
  const page = await getOwnedStatusPage(Number((await params).id), user.id);
  return { title: page?.name ?? "" };
}

const SHOWN_SUBSCRIBERS = 50;

export default async function StatusPageBuilderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireDashboardUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const page = await getOwnedStatusPage(Number(id), user.id);
  if (!page) notFound();
  const [t, locale, monitors, components, subscribers, base] = await Promise.all([
    getT(),
    getLocale(),
    getUserMonitorsCached(user.id),
    getPageComponents(page.id),
    getSubscribers(page.id),
    baseUrl(),
  ]);
  const lc = locale.code;
  const publicUrl = `${base}/s/${page.slug}`;
  const badgeUrl = `${base}/badge/${page.slug}.svg`;
  const owned = new Set(monitors.map((m) => m.id));
  const confirmed = subscribers.filter((s) => s.confirmed_at);

  return (
    <>
      {query.created === "1" ? (
        <>
          <RefreshOnce cleanUrl={`/dashboard/status-pages/${page.id}`} />
          <Alert tone="success" className="mb-6" title={t("dash.pages.createdTitle")}>
            {t("dash.pages.createdText")}
          </Alert>
        </>
      ) : null}
      <Link href="/dashboard/status-pages" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("dash.nav.statusPages")}
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 dir="auto" className="truncate text-2xl font-bold">{page.name}</h1>
            {page.isPublic ? <Badge tone="success">{t("dash.pages.live")}</Badge> : <Badge>{t("dash.pages.private")}</Badge>}
          </div>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block truncate text-sm text-muted hover:text-primary" dir="ltr">
            {publicUrl.replace(/^https?:\/\//, "")}
          </a>
        </div>
        <ButtonLink href={publicUrl} target="_blank" rel="noopener noreferrer" variant="outline">
          <ExternalLink aria-hidden />
          {t("dash.pages.open")}
        </ButtonLink>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="min-w-0">
          <StatusPageBuilder
            page={{
              id: page.id,
              name: page.name,
              slug: page.slug,
              description: page.description,
              logo: page.logo,
              logoSrc: uploadUrl(page.logo),
              isPublic: page.isPublic,
              settings: page.settings,
            }}
            components={components.filter((c) => owned.has(c.monitorId)).map((c) => ({ monitorId: c.monitorId, displayName: c.displayName, groupName: c.groupName }))}
            monitors={monitors.map((m) => ({ id: m.id, name: m.name, type: m.type, status: effectiveStatus(m) }))}
            prefix={`${base.replace(/^https?:\/\//, "")}/s/`}
          />
        </Panel>

        <div className="min-w-0 space-y-6">
          <Panel title={t("dash.pages.share")} description={t("dash.pages.shareText")}>
            <div className="space-y-5">
              <CopyField value={publicUrl} label={t("dash.pages.publicLink")} />
              <div>
                <p className="mb-1.5 text-sm font-medium">{t("dash.pages.badge")}</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- live SVG badge */}
                <img src={`/badge/${page.slug}.svg`} alt={t("dash.pages.badgeAlt")} className="mb-2 h-5" />
                <p className="mb-2 text-xs text-muted">{t("dash.pages.badgeOptions")}</p>
                <CopyField value={`[![${page.name}](${badgeUrl})](${publicUrl})`} label={t("dash.pages.badgeMarkdown")} multiline />
                <CopyField value={`<a href="${publicUrl}"><img src="${badgeUrl}" alt="${page.name.replace(/"/g, "&quot;")}"></a>`} label={t("dash.pages.badgeHtml")} multiline className="mt-2" />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium">{t("dash.pages.widget")}</p>
                <p className="mb-2 text-xs text-muted">{t("dash.pages.widgetText")}</p>
                <CopyField value={`<script async src="${base}/sz.js" data-page="${page.slug}" data-position="bottom-right" data-theme="auto"></script>`} label={t("dash.pages.widget")} multiline />
                <p className="mt-2 text-xs text-muted">{t("dash.pages.widgetOptions")}</p>
              </div>
            </div>
          </Panel>

          <Panel
            title={t("dash.pages.subscribers")}
            description={t("dash.subs.count", { n: formatNumber(confirmed.length, lc) })}
            padded={false}
            actions={
              subscribers.length ? (
                <ButtonLink href={`/dashboard/status-pages/${page.id}/subscribers`} variant="outline" size="sm" prefetch={false}>
                  <Download aria-hidden />
                  {t("dash.subs.export")}
                </ButtonLink>
              ) : null
            }
          >
            {subscribers.length ? (
              <>
                <ul className="divide-y divide-line">
                  {subscribers.slice(0, SHOWN_SUBSCRIBERS).map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm" dir="ltr">
                          {s.email}
                        </p>
                        <p className="text-xs text-muted">{s.confirmed_at ? formatDateTime(s.confirmed_at, lc, false) : t("dash.subs.unconfirmed")}</p>
                      </div>
                      <ActionButton
                        action={removeSubscriberAction}
                        fields={{ page_id: page.id, subscriber_id: s.id }}
                        variant="ghost"
                        label={t("ui.remove", { name: s.email })}
                        confirmText={t("dash.subs.removeConfirm", { email: s.email })}
                        buttonClassName="size-8 px-0 hover:text-red-600"
                      >
                        <Trash aria-hidden />
                      </ActionButton>
                    </li>
                  ))}
                </ul>
                {subscribers.length > SHOWN_SUBSCRIBERS ? (
                  <p className="border-t border-line px-5 py-3 text-xs text-muted">{t("dash.subs.more", { n: subscribers.length - SHOWN_SUBSCRIBERS })}</p>
                ) : null}
              </>
            ) : (
              <Empty icon={<Mail />} title={t("dash.subs.emptyTitle")}>
                {page.settings.allowSubscribe ? t("dash.subs.emptyText") : t("dash.subs.disabled")}
              </Empty>
            )}
          </Panel>

          <Panel title={t("dash.pages.danger")}>
            <p className="mb-4 text-sm text-muted">{t("dash.pages.deleteText")}</p>
            <ActionButton action={deleteStatusPageAction} fields={{ page_id: page.id }} variant="danger" confirmText={t("dash.pages.deleteConfirm", { name: page.name })}>
              <Trash aria-hidden />
              {t("dash.pages.delete")}
            </ActionButton>
          </Panel>
        </div>
      </div>
    </>
  );
}
