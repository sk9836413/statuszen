import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardShell, type ShellBanner } from "@/components/dashboard/shell";
import { BrandStyle } from "@/components/site/brand-style";
import { ThemeScript, type ThemeChoice } from "@/components/site/theme";
import { isDemoMode } from "@/lib/config";
import { requireDashboardUser } from "@/lib/dashboard";
import { countOpenIncidents, getUserMonitorsCached } from "@/lib/dashboard-data";
import { I18nProvider } from "@/lib/i18n/client";
import { getClientMessages, getLocale, getT } from "@/lib/i18n/server";
import { maybeLazyTick } from "@/lib/lazy-tick";
import { getEntitlements } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { uploadUrl } from "@/lib/site";
import { countUserStatusPages } from "@/lib/status-pages";

// Every dashboard page reads the signed-in user's data at request time.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, t] = await Promise.all([getSettings(), getT()]);
  const favicon = uploadUrl(settings.favicon);
  return {
    title: { default: t("dash.title"), template: `%s${settings.title_separator}${settings.site_name}` },
    robots: { index: false, follow: false },
    icons: favicon ? { icon: favicon, apple: favicon } : { icon: "/icon.svg" },
  };
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireDashboardUser();
  // Without a cron job, checks also run when people use the app.
  Promise.resolve()
    .then(() => maybeLazyTick())
    .catch(() => {});

  const [settings, locale, t, messages, entitlements, monitors, pageCount, openIncidents] = await Promise.all([
    getSettings(),
    getLocale(),
    getT(),
    getClientMessages(),
    getEntitlements(user),
    getUserMonitorsCached(user.id),
    countUserStatusPages(user.id),
    countOpenIncidents(user.id),
  ]);

  // Over a plan limit (e.g. after a downgrade), or at it.
  let banner: ShellBanner | null = null;
  const { maxMonitors, maxStatusPages } = entitlements;
  if ((maxMonitors > 0 && monitors.length > maxMonitors) || (maxStatusPages > 0 && pageCount > maxStatusPages)) {
    banner = { tone: "danger", text: t("dash.banner.overLimit") };
  } else if (maxMonitors > 0 && monitors.length >= maxMonitors) {
    banner = { tone: "warning", text: t("dash.banner.monitorsReached", { limit: maxMonitors }) };
  } else if (maxStatusPages > 0 && pageCount >= maxStatusPages && !entitlements.isPremium) {
    banner = { tone: "warning", text: t("dash.banner.pagesReached", { limit: maxStatusPages }) };
  }

  const down = monitors.filter((m) => m.isActive && m.status === "down").length;
  const langScript = `document.documentElement.lang=${JSON.stringify(locale.code)};document.documentElement.dir=${JSON.stringify(locale.dir)};`;

  return (
    <I18nProvider messages={messages}>
      <ThemeScript defaultTheme={settings.default_theme as ThemeChoice} />
      <script dangerouslySetInnerHTML={{ __html: langScript }} />
      <BrandStyle color={settings.primary_color} />
      <div dir={locale.dir} lang={locale.code}>
        <DashboardShell
          siteName={settings.site_name}
          logo={uploadUrl(settings.logo)}
          logoDark={uploadUrl(settings.logo_dark)}
          user={{ name: user.name, email: user.email, isAdmin: user.role === "admin" }}
          counts={{ down, openIncidents }}
          banner={banner}
          demo={isDemoMode()}
          defaultTheme={settings.default_theme as ThemeChoice}
          isPremium={entitlements.isPremium}
        >
          {children}
        </DashboardShell>
      </div>
    </I18nProvider>
  );
}
