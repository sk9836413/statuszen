import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import type { Translator } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { LANDING_CHANNELS } from "./channels";
import { HeroMockup } from "./hero-mockup";

export function Hero({
  t,
  title,
  subtitle,
  signedIn,
  interval,
  site,
}: {
  t: Translator;
  title: string;
  subtitle: string;
  signedIn: boolean;
  /** Fastest check interval of the active plans, formatted ("30 sec"). */
  interval: string;
  site: string;
}) {
  const trust = [t("home.trustFree"), t("home.trustInterval", { interval }), t("home.trustSetup")];
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-line">
      <div aria-hidden className="mat-grid mat-grid-fade absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-56 mx-auto h-[560px] max-w-5xl rounded-full bg-primary/20 blur-[120px] dark:bg-primary/25" />
      <div aria-hidden className="pointer-events-none absolute -end-32 top-56 size-[380px] rounded-full bg-emerald-400/20 blur-[110px] dark:bg-emerald-500/10" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-4 pt-14 pb-16 sm:gap-20 sm:px-6 sm:pt-20 sm:pb-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14 lg:pt-24 lg:pb-32">
        <div className="text-center lg:text-start">
          <Link
            href="#features"
            className="group inline-flex max-w-full animate-tz-rise items-center gap-2 rounded-full border border-primary-line bg-surface/80 py-1 ps-3 pe-3 sm:ps-1.5 text-sm font-medium shadow-sm backdrop-blur transition-colors hover:border-primary motion-reduce:animate-none"
          >
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-semibold text-emerald-700 max-sm:hidden dark:text-emerald-400">
              <span className="relative flex size-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/70 motion-reduce:animate-none" />
                <span className="relative size-1.5 rounded-full bg-emerald-500" />
              </span>
              {t("status.state.operational")}
            </span>
            <span className="truncate">{t("home.eyebrow")}</span>
            <ArrowRight
              className="size-3.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary-text rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              aria-hidden
            />
          </Link>

          <h1
            id="hero-title"
            className="mx-auto mt-7 max-w-[16ch] animate-tz-rise bg-gradient-to-b from-ink from-40% to-ink/70 bg-clip-text text-[2.6rem] leading-[1.03] font-bold tracking-[-0.035em] text-balance text-transparent [animation-delay:80ms] motion-reduce:animate-none sm:text-6xl lg:mx-0 lg:text-[3.6rem] xl:text-[4.1rem]"
          >
            {title}
          </h1>
          <p className="mx-auto mt-6 max-w-[54ch] animate-tz-rise text-lg leading-relaxed text-muted [animation-delay:160ms] motion-reduce:animate-none lg:mx-0">
            {subtitle}
          </p>

          <div className="mt-9 flex animate-tz-rise flex-wrap justify-center gap-3 [animation-delay:240ms] motion-reduce:animate-none lg:justify-start">
            <Link href={signedIn ? "/dashboard" : "/register"} className={buttonClass("primary", "lg", "group shadow-lg shadow-primary/30")}>
              {signedIn ? t("nav.dashboard") : t("home.ctaStart")}
              <ArrowRight aria-hidden className="transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </Link>
            <Link href="/pricing" className={buttonClass("outline", "lg")}>
              {t("home.ctaPricing")}
            </Link>
          </div>

          <ul className="mt-7 flex animate-tz-rise flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted [animation-delay:320ms] motion-reduce:animate-none lg:justify-start">
            {trust.map((text) => (
              <li key={text} className="flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden strokeWidth={2.5} />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:ps-6">
          <HeroMockup t={t} site={site} />
        </div>
      </div>
    </section>
  );
}

/** Numbers strip (Admin → Settings → Home page) and the alert channel list. */
export function ProofStrip({ t, showStats, interval }: { t: Translator; showStats: boolean; interval: string }) {
  const stats: Array<[string, string]> = [
    [t("home.stat1Value"), t("home.stat1Label")],
    [t("home.stat2Value"), t("home.stat2Label")],
    [interval, t("home.stat3Label")],
    [t("home.stat4Value"), t("home.stat4Label")],
  ];
  return (
    <section aria-label={t("home.statsLabel")} className="border-b border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {showStats ? (
          <dl className="grid grid-cols-2 border-b border-line md:grid-cols-4">
            {stats.map(([value, label], i) => (
              <div
                key={label}
                className={cn(
                  "flex flex-col-reverse gap-1 px-2 py-7 text-center sm:py-9",
                  i % 2 === 1 && "border-s border-line",
                  i >= 2 && "border-t border-line md:border-t-0",
                  i === 2 && "md:border-s",
                )}
              >
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="font-display text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="flex flex-col items-center gap-4 py-7 md:flex-row md:justify-center md:gap-7">
          <p className="shrink-0 text-xs font-semibold tracking-[0.14em] text-muted uppercase">{t("home.alertsTo")}</p>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-3">
            {LANDING_CHANNELS.map((c) => (
              <li key={c.type} className="flex items-center gap-2 font-display text-[15px] font-semibold text-ink/70">
                <span className={cn("grid size-6 place-items-center rounded-md text-white", c.tile)}>
                  <c.icon className="size-3.5" aria-hidden />
                </span>
                {t(`dash.channel.${c.type}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
