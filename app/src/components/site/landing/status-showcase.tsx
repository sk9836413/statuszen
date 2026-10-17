import Link from "next/link";
import { ArrowRight, BadgeCheck, Code, History, Mail, Palette, Rss } from "lucide-react";
import { BAR_CLASS, barTone, formatPercent } from "@/components/status/format";
import { STATE_TONE, StateLabel } from "@/components/status/state";
import type { Translator } from "@/lib/i18n/messages";
import { uploadUrl } from "@/lib/site";
import { getPublicStatusPage, loadStatusView, type ComponentState } from "@/lib/status-view";
import type { OverallStatus } from "@/monitor/types";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

const DAYS = 45;
const MAX_COMPONENTS = 4;

export interface ShowcasePage {
  slug: string;
  name: string;
  logo: string;
  overall: OverallStatus;
  components: Array<{ name: string; state: ComponentState; days: Array<number | null>; uptime: number | null }>;
  more: number;
}

/** The status page chosen in Admin → Settings (`showcase_status_slug`), with live data, or null. */
export async function loadShowcase(slug: string): Promise<ShowcasePage | null> {
  if (!slug.trim()) return null;
  try {
    const page = await getPublicStatusPage(slug.trim());
    if (!page) return null;
    const view = await loadStatusView(page, { response: false });
    if (!view.components.length) return null;
    return {
      slug: page.slug,
      name: page.name,
      logo: uploadUrl(page.logo),
      overall: view.overall,
      components: view.components.slice(0, MAX_COMPONENTS).map((c) => ({
        name: c.name,
        state: c.state,
        days: c.days.slice(-DAYS).map((d) => d.uptime),
        uptime: c.uptime[30] ?? null,
      })),
      more: Math.max(0, view.components.length - MAX_COMPONENTS),
    };
  } catch {
    return null;
  }
}

/** Deterministic bars for the example page. */
function exampleDays(seed: number): Array<number | null> {
  return Array.from({ length: DAYS }, (_, i) => {
    const n = (i * 37 + seed * 101) % 97;
    if (n === 3) return 97.4;
    if (n === 11 || n === 59) return 99.6;
    return 100;
  });
}

const FEATURES: Array<{ icon: typeof Palette; key: "brand" | "subs" | "history" | "feed" | "badge" | "widget" }> = [
  { icon: Palette, key: "brand" },
  { icon: Mail, key: "subs" },
  { icon: History, key: "history" },
  { icon: Rss, key: "feed" },
  { icon: BadgeCheck, key: "badge" },
  { icon: Code, key: "widget" },
];

export function StatusShowcase({ t, live, host, locale }: { t: Translator; live: ShowcasePage | null; host: string; locale: string }) {
  const page: ShowcasePage = live ?? {
    slug: "acme",
    name: t("home.preview.name"),
    logo: "",
    overall: "operational",
    components: (["home.preview.c1", "home.preview.c2", "home.preview.c3", "home.preview.c4"] as const).map((key, i) => ({
      name: t(key),
      state: "operational",
      days: exampleDays(i + 1),
      uptime: [99.98, 100, 99.95, 100][i],
    })),
    more: 0,
  };
  const tone = STATE_TONE[page.overall];
  const OverallIcon = tone.icon;

  return (
    <section aria-labelledby="pages-title" className="relative overflow-hidden py-24 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute -start-40 top-1/3 size-[420px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
        <div className="lg:order-last">
          <SectionHeading id="pages-title" eyebrow={t("home.pagesEyebrow")} title={t("home.pagesTitle")} text={t("home.pagesText")} />
          <ul className="mt-10 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, key }) => (
              <li key={key} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{t(`home.pf.${key}Title`)}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-muted">{t(`home.pf.${key}Text`)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <figure
            aria-label={t("home.preview.label", { name: page.name })}
            className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_40px_90px_-40px_rgba(29,91,216,0.45)] dark:shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center gap-3 border-b border-line bg-paper/70 px-4 py-2.5">
              <span aria-hidden className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-line" />
                <span className="size-2.5 rounded-full bg-line" />
                <span className="size-2.5 rounded-full bg-line" />
              </span>
              <span className="min-w-0 flex-1 truncate rounded-md border border-line bg-surface px-2.5 py-1 text-center font-mono text-[11px] text-muted" dir="ltr">
                {host}/s/{page.slug}
              </span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  live ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-primary-soft text-primary-text",
                )}
              >
                {live ? (
                  <span className="relative flex size-1.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/70 motion-reduce:animate-none" />
                    <span className="relative size-1.5 rounded-full bg-emerald-500" />
                  </span>
                ) : null}
                {live ? t("home.preview.live") : t("home.preview.example")}
              </span>
            </div>

            <div className="space-y-4 bg-paper/40 p-4 sm:p-6">
              <div className="flex items-center gap-3">
                {page.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- customer-uploaded logo of unknown size
                  <img src={page.logo} alt="" className="h-8 w-auto max-w-[160px] object-contain" />
                ) : (
                  <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-white">
                    {page.name.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="truncate font-display font-semibold">{page.name}</span>
              </div>

              <div className={cn("flex items-center gap-3 rounded-xl border p-3.5 sm:p-4", tone.panel)}>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-white ring-4", tone.solid, tone.ring)}>
                  <OverallIcon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-display font-semibold">{t(`status.overall.${page.overall}`)}</span>
                  <span className="block truncate text-xs text-muted max-sm:hidden">{t(`status.overallText.${page.overall}`)}</span>
                </span>
              </div>

              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {page.components.map((c, i) => (
                  <li key={i} className="px-3.5 py-3 sm:px-4">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
                      {c.uptime !== null ? (
                        <span className="text-[11px] text-muted tabular-nums max-[420px]:hidden">{t("status.uptimeFor", { percent: formatPercent(c.uptime, locale) })}</span>
                      ) : null}
                      <StateLabel state={c.state} label={t(`status.state.${c.state}`)} className="text-xs [&_svg]:size-3.5" />
                    </div>
                    <div aria-hidden className="mt-2 flex h-5 items-stretch gap-[2px]">
                      {c.days.map((u, d) => (
                        <span key={d} className={cn("min-w-0 flex-1 rounded-[2px]", BAR_CLASS[barTone(u)], d < DAYS - 30 && "max-sm:hidden")} />
                      ))}
                    </div>
                  </li>
                ))}
                {page.more ? <li className="px-4 py-2.5 text-center text-xs font-medium text-muted">{t("home.preview.more", { n: page.more })}</li> : null}
              </ul>
            </div>
          </figure>
          {live ? (
            <Link href={`/s/${live.slug}`} className="group mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-text hover:underline">
              {t("home.preview.open")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
