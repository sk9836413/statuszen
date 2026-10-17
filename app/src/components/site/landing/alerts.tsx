import { BadgeCheck, BellRing, Wrench } from "lucide-react";
import type { Translator } from "@/lib/i18n/messages";
import type { ChannelType } from "@/monitor/types";
import { cn } from "@/lib/utils";
import { LANDING_CHANNELS } from "./channels";
import { SectionHeading } from "./section-heading";

function ChannelChips({ t, types }: { t: Translator; types: ChannelType[] }) {
  return (
    <span className="mt-1.5 flex flex-wrap gap-1.5">
      {types.map((type) => {
        const c = LANDING_CHANNELS.find((x) => x.type === type)!;
        return (
          <span key={type} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface py-0.5 ps-0.5 pe-2 text-xs font-medium">
            <span className={cn("grid size-4 place-items-center rounded text-white", c.tile)}>
              <c.icon className="size-2.5" aria-hidden />
            </span>
            {t(`dash.channel.${type}`)}
          </span>
        );
      })}
    </span>
  );
}

export function Alerts({ t }: { t: Translator }) {
  const benefits = [
    { icon: BadgeCheck, title: t("home.alertConfirmTitle"), text: t("home.alertConfirmText") },
    { icon: BellRing, title: t("home.alertRemindTitle"), text: t("home.alertRemindText") },
    { icon: Wrench, title: t("home.alertMaintTitle"), text: t("home.alertMaintText") },
  ];
  const timeline = [
    { time: "10:02", dot: "bg-amber-400", title: t("home.tl.e1"), meta: <span className="text-amber-700 dark:text-amber-400">{t("home.tl.e1meta")}</span> },
    { time: "10:04", dot: "bg-red-500", title: t("home.tl.e2"), meta: <ChannelChips t={t} types={["slack", "email", "teams"]} /> },
    { time: "10:04", dot: "bg-primary", title: t("home.tl.e3"), meta: t("home.tl.e3meta") },
    { time: "10:34", dot: "bg-orange-500", title: t("home.tl.e4"), meta: <ChannelChips t={t} types={["slack"]} /> },
    {
      time: "10:39",
      dot: "bg-emerald-500",
      title: t("home.tl.e5", { duration: t("time.minutes", { n: 35 }) }),
      meta: t("home.tl.e5meta"),
    },
  ];

  return (
    <section aria-labelledby="alerts-title" className="border-y border-line bg-surface py-24 sm:py-28">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <SectionHeading id="alerts-title" eyebrow={t("home.alertsEyebrow")} title={t("home.alertsTitle")} text={t("home.alertsText")} />
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {LANDING_CHANNELS.map((c) => (
              <li key={c.type} className="rounded-xl border border-line bg-paper p-4 transition-colors hover:border-primary-line">
                <span className={cn("grid size-9 place-items-center rounded-lg text-white shadow-sm", c.tile)}>
                  <c.icon className="size-[18px]" aria-hidden />
                </span>
                <p className="mt-3 text-sm font-semibold">{t(`dash.channel.${c.type}`)}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{t(`home.ch.${c.type}`)}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-6 lg:pt-4">
          <figure className="rounded-2xl border border-line bg-paper p-5 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.4)] sm:p-6 dark:shadow-none">
            <figcaption className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display font-semibold">{t("home.tl.title")}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium">
                <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
                {t("home.mock.m2")}
              </span>
            </figcaption>
            <div className="relative mt-6">
              <span aria-hidden className="absolute start-[5px] top-2 bottom-2 w-px bg-gradient-to-b from-amber-400 via-red-400 to-emerald-400 opacity-60" />
              <ol className="relative space-y-5">
                {timeline.map((e, i) => (
                  <li key={i} className="relative flex gap-4 ps-7">
                    <span aria-hidden className={cn("absolute start-0 top-1.5 size-[11px] rounded-full ring-4 ring-paper", e.dot)} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-sm font-semibold">{e.title}</span>
                        <time className="font-mono text-xs text-muted tabular-nums" dir="ltr">
                          {e.time}
                        </time>
                      </p>
                      <div className="text-xs text-muted">{e.meta}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </figure>

          <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {benefits.map((b) => (
              <li key={b.title} className="flex gap-3 xl:flex-col xl:gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
                  <b.icon className="size-[18px]" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{b.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-muted">{b.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
