import { CircleCheck, CircleX, Play } from "lucide-react";
import type { Translator } from "@/lib/i18n/messages";
import { SectionHeading } from "./section-heading";

/** Cron / heartbeat monitoring with a real crontab line for this installation. */
export function Heartbeat({ t, pingUrl }: { t: Translator; pingUrl: string }) {
  const endpoints = [
    { path: "", icon: CircleCheck, tone: "text-emerald-600 dark:text-emerald-400", text: t("home.hbSuccess") },
    { path: "/start", icon: Play, tone: "text-primary-text", text: t("home.hbStart") },
    { path: "/fail", icon: CircleX, tone: "text-red-600 dark:text-red-400", text: t("home.hbFail") },
  ];
  return (
    <section aria-labelledby="hb-title" className="border-t border-line bg-surface py-24 sm:py-28">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
        <div>
          <SectionHeading id="hb-title" eyebrow={t("home.hbEyebrow")} title={t("home.hbTitle")} text={t("home.hbText")} />
          <dl className="mt-10 space-y-3">
            {endpoints.map((e) => (
              <div key={e.path} className="flex items-start gap-3 rounded-xl border border-line bg-paper p-3.5">
                <e.icon className={`mt-0.5 size-4 shrink-0 ${e.tone}`} aria-hidden strokeWidth={2.5} />
                <div className="min-w-0">
                  <dt className="text-start font-mono text-xs font-semibold [font-variant-ligatures:none]" dir="ltr">
                    <span className="text-muted">…/api/ping/YOUR_TOKEN</span>
                    {e.path}
                  </dt>
                  <dd className="mt-0.5 text-sm text-muted">{e.text}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div aria-hidden className="absolute -inset-4 -z-0 rounded-[2rem] bg-gradient-to-tr from-primary/20 to-emerald-400/10 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1220] text-slate-300 shadow-2xl shadow-slate-900/30 dark:border-white/10 dark:bg-[#060a12]">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3" dir="ltr">
              <span aria-hidden className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-white/15" />
                <span className="size-2.5 rounded-full bg-white/15" />
                <span className="size-2.5 rounded-full bg-white/15" />
              </span>
              <span className="font-mono text-xs text-slate-400">crontab -e</span>
            </div>
            {/* One crontab line (cron has no line continuation); it scrolls on phones and wraps on wider screens. */}
            <pre className="overflow-x-auto p-5 font-mono [font-variant-ligatures:none] text-[13px] leading-6 whitespace-pre sm:p-6 sm:whitespace-pre-wrap sm:[overflow-wrap:anywhere]" dir="ltr" tabIndex={0}>
              <code>
                <span className="text-slate-500"># {t("home.hbComment")}</span>
                {"\n"}
                <span className="text-amber-300">0 2 * * *</span> <span className="text-sky-300">/usr/local/bin/backup.sh</span> &amp;&amp;{" "}
                <span className="text-emerald-300">curl</span> -fsS -m 10 --retry 3 <span className="text-white">{pingUrl}</span>
              </code>
            </pre>
            <div className="m-3 mt-0 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs">
              <span className="flex items-center gap-2 font-semibold text-white">
                <span className="relative flex size-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none" />
                  <span className="relative size-2 rounded-full bg-emerald-400" />
                </span>
                {t("home.hbMonitor")}
              </span>
              <span className="text-slate-400">{t("home.hbLast", { time: t("time.hours", { n: 6 }) })}</span>
              <span className="text-slate-400">{t("home.hbNext", { time: t("time.hours", { n: 18 }) })}</span>
              <span className="text-slate-400">{t("home.hbGrace", { time: t("time.minutes", { n: 30 }) })}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
