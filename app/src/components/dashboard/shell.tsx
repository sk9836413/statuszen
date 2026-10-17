"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BellRing,
  CalendarClock,
  CircleUser,
  Crown,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelsTopLeft,
  Shield,
  Siren,
  Sparkles,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/site/logo";
import { ThemeToggle, type ThemeChoice } from "@/components/site/theme";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

export interface ShellBanner {
  tone: "warning" | "danger";
  text: string;
}

export interface ShellCounts {
  down: number;
  openIncidents: number;
}

const NAV: Array<{ href: string; label: MessageKey; icon: LucideIcon; exact?: boolean; count?: keyof ShellCounts }> = [
  { href: "/dashboard", label: "dash.nav.overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/monitors", label: "dash.nav.monitors", icon: Activity, count: "down" },
  { href: "/dashboard/incidents", label: "dash.nav.incidents", icon: Siren, count: "openIncidents" },
  { href: "/dashboard/status-pages", label: "dash.nav.statusPages", icon: PanelsTopLeft },
  { href: "/dashboard/channels", label: "dash.nav.channels", icon: BellRing },
  { href: "/dashboard/maintenance", label: "dash.nav.maintenance", icon: CalendarClock },
];

const navLink = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
    active ? "bg-primary-soft text-primary" : "text-muted hover:bg-paper hover:text-ink",
  );

export function DashboardShell({
  siteName,
  logo,
  logoDark,
  user,
  counts,
  banner,
  demo,
  defaultTheme,
  isPremium,
  children,
}: {
  siteName: string;
  logo: string;
  logoDark: string;
  user: { name: string; email: string; isAdmin: boolean };
  counts: ShellCounts;
  banner: ShellBanner | null;
  demo: boolean;
  defaultTheme: ThemeChoice;
  isPremium: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Close the drawer after each navigation (derived state, no effect needed).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const nav = (
    <nav aria-label={t("dash.nav.label")} className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-0.5">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const count = item.count ? counts[item.count] : 0;
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={navLink(active)}>
                <item.icon className="size-[18px]" aria-hidden />
                <span className="flex-1">{t(item.label)}</span>
                {count > 0 ? (
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold tabular-nums",
                      item.count === "down" ? "bg-red-600 text-white" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                    )}
                  >
                    <span className="sr-only">{item.count === "down" ? t("dash.nav.downCount", { n: count }) : t("dash.nav.openCount", { n: count })}</span>
                    <span aria-hidden>{count}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const footer = (
    <div className="space-y-0.5 border-t border-line p-3">
      <Link href="/account" className={navLink(false)}>
        <CircleUser className="size-[18px]" aria-hidden />
        {t("dash.nav.account")}
      </Link>
      <Link href="/pricing" className={navLink(false)}>
        {isPremium ? <Sparkles className="size-[18px]" aria-hidden /> : <Crown className="size-[18px] text-amber-500" aria-hidden />}
        {isPremium ? t("dash.nav.pricing") : t("dash.nav.upgrade")}
      </Link>
      {user.isAdmin ? (
        <Link href="/admin" className={navLink(false)}>
          <Shield className="size-[18px]" aria-hidden />
          {t("nav.admin")}
        </Link>
      ) : null}
      <div className="mt-2 flex items-center gap-2 border-t border-line px-1 pt-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary uppercase" aria-hidden>
          {(user.name || user.email).slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <ThemeToggle defaultTheme={defaultTheme} />
        <form action={logout}>
          <button
            type="submit"
            aria-label={t("nav.signOut")}
            title={t("nav.signOut")}
            className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-primary-soft hover:text-ink"
          >
            <LogOut className="size-[18px] rtl:rotate-180" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[256px_1fr]">
      <a
        href="#dash-main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        {t("nav.skipToContent")}
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-line bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
          <Logo siteName={siteName} logo={logo} logoDark={logoDark} href="/dashboard" />
        </div>
        {nav}
        {footer}
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("nav.openMenu")}
          aria-expanded={open}
          className="relative grid size-9 place-items-center rounded-lg text-muted hover:bg-primary-soft hover:text-ink"
        >
          <Menu className="size-5" aria-hidden />
          {counts.down > 0 ? <span className="absolute end-1 top-1 size-2 rounded-full bg-red-600 ring-2 ring-surface" aria-hidden /> : null}
        </button>
        <Logo siteName={siteName} logo={logo} logoDark={logoDark} href="/dashboard" />
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("dash.nav.label")}>
          <button type="button" aria-label={t("nav.closeMenu")} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 start-0 flex w-[min(20rem,88vw)] flex-col bg-surface shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
              <Logo siteName={siteName} logo={logo} logoDark={logoDark} href="/dashboard" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("nav.closeMenu")}
                className="grid size-9 place-items-center rounded-lg text-muted hover:bg-primary-soft hover:text-ink"
                autoFocus
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      ) : null}

      <main id="dash-main" className="min-w-0">
        {demo ? <p className="bg-marker px-4 py-2 text-center text-sm font-medium text-[#3d2e00]">{t("dash.demo")}</p> : null}
        {banner ? (
          <div
            role="status"
            className={cn(
              "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-center text-sm",
              banner.tone === "danger"
                ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
            )}
          >
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            <span>{banner.text}</span>
            <Link href="/pricing" className="font-semibold underline underline-offset-2">
              {t("dash.banner.cta")}
            </Link>
          </div>
        ) : null}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
