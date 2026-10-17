import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Lock, Megaphone, Rss } from "lucide-react";
import { LocalTimes } from "@/components/status/local-times";
import { SubscribeButton } from "@/components/status/subscribe";
import { StatusTheme } from "@/components/status/theme";
import { Time } from "@/components/status/time";
import { interpolateParts } from "@/lib/i18n/messages";
import { getLocale, getT } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { absoluteUrl, uploadUrl } from "@/lib/site";
import { getBranding, getViewablePage } from "@/lib/status-view";

type Props = { children: ReactNode; params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  const found = await getViewablePage(slug);
  if (!found) return { robots: { index: false } };
  const { page } = found;
  const [settings, t] = await Promise.all([getSettings(), getT()]);
  const title = t("status.metaTitle", { name: page.name });
  const description = page.description || t("status.metaDescription", { name: page.name });
  const icon = uploadUrl(page.logo) || uploadUrl(settings.favicon) || "/icon.svg";
  return {
    metadataBase: new URL(absoluteUrl(settings)),
    title: { default: title, template: `%s · ${title}` },
    description,
    icons: { icon },
    robots: page.settings.noindex || !page.isPublic ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: `/s/${page.slug}`,
      types: { "application/atom+xml": [{ url: `/s/${page.slug}/feed.xml`, title }] },
    },
    openGraph: { type: "website", title, description, siteName: page.name },
  };
}

export default async function StatusPageLayout({ children, params }: Props) {
  const { slug } = await params;
  const found = await getViewablePage(slug);
  if (!found) notFound();
  const { page, preview } = found;
  const [settings, t, locale, branding] = await Promise.all([getSettings(), getT(), getLocale(), getBranding(page)]);
  const s = page.settings;
  const home = `/s/${page.slug}`;
  const logo = uploadUrl(page.logo);
  const renderedAt = new Date().toISOString();

  return (
    <>
      <StatusTheme theme={s.theme} accent={s.accent || settings.primary_color} />
      <LocalTimes locale={locale.code} />

      {preview ? (
        <p className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-sm font-medium text-paper">
          <Lock className="size-4" aria-hidden />
          {t("status.privatePreview")}
        </p>
      ) : null}
      {s.announcement ? (
        <div className="border-b border-primary-line/60 bg-primary-soft">
          <p className="mx-auto flex max-w-3xl items-start gap-2.5 px-5 py-2.5 text-sm text-ink">
            <Megaphone className="mt-0.5 size-4 shrink-0 text-primary-text" aria-hidden />
            <span className="break-words">{s.announcement}</span>
          </p>
        </div>
      ) : null}

      <header className="relative">
        {/* Soft accent glow behind the header and the status banner. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(60rem_18rem_at_50%_-6rem,color-mix(in_oklab,var(--primary)_16%,transparent),transparent)]"
        />
        <div className="mx-auto flex h-20 max-w-3xl items-center justify-between gap-4 px-5">
          <a href={s.websiteUrl || home} className="flex min-w-0 items-center gap-3" rel={s.websiteUrl ? "noopener" : undefined}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- customer-uploaded logo of unknown size
              <img src={logo} alt={page.name} className="h-9 w-auto max-w-[200px] object-contain" />
            ) : (
              <>
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-white shadow-sm">
                  {Array.from(page.name.trim())[0]?.toUpperCase() ?? "S"}
                </span>
                <span dir="auto" className="truncate font-display text-lg font-semibold tracking-tight text-ink">{page.name}</span>
              </>
            )}
          </a>
          <nav className="flex shrink-0 items-center gap-1.5">
            {s.websiteUrl ? (
              <a
                href={s.websiteUrl}
                rel="noopener"
                className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-primary-soft hover:text-ink"
              >
                <span className="hidden sm:inline">{t("status.website")}</span>
                <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
                <span className="sr-only sm:hidden">{t("status.website")}</span>
              </a>
            ) : null}
            {s.allowSubscribe && !preview ? (
              <SubscribeButton
                slug={page.slug}
                labels={{
                  button: t("status.subscribe"),
                  title: t("status.subscribeTitle"),
                  text: t("status.subscribeText", { name: page.name }),
                  email: t("status.email"),
                  submit: t("status.subscribe"),
                  pending: t("status.subscribing"),
                  close: t("status.close"),
                }}
              />
            ) : null}
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="mx-auto w-full max-w-3xl px-5 pt-4 pb-10">
        <div className="flex flex-col gap-4 border-t border-line pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href={`${home}/history`} className="transition-colors hover:text-ink">
              {t("status.history")}
            </Link>
            <a href={`${home}/feed.xml`} className="inline-flex items-center gap-1.5 transition-colors hover:text-ink">
              <Rss className="size-3.5" aria-hidden />
              {t("status.feed")}
            </a>
            <span>
              {interpolateParts(t("status.lastUpdated"), { time: <Time key="t" iso={renderedAt} locale={locale.code} format="time" /> })}
            </span>
          </div>
          {branding ? (
            <a href={branding.url} className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-ink" rel="noopener">
              <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
              {branding.text}
            </a>
          ) : null}
        </div>
      </footer>
    </>
  );
}
