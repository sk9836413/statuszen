import { CircleCheck, CircleX, TrendingUp } from "lucide-react";
import type { Translator } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { LANDING_CHANNELS } from "./channels";

/** Deterministic 24 h response-time series (ms); null = the 3 minutes the site was down. */
const SERIES: Array<number | null> = Array.from({ length: 48 }, (_, i) => {
  if (i === 33 || i === 34) return null;
  if (i === 32) return 248;
  if (i === 35) return 196;
  return Math.round(132 + 16 * Math.sin(i / 3.1) + 8 * Math.sin(i / 1.7 + 1) + (i % 9 === 4 ? 22 : 0));
});

const W = 600;
const H = 112;
const MIN = 80;
const MAX = 270;
const px = (i: number) => (i / (SERIES.length - 1)) * W;
const py = (v: number) => H - 8 - ((v - MIN) / (MAX - MIN)) * (H - 20);

function chartPaths() {
  const runs: Array<Array<[number, number]>> = [];
  let run: Array<[number, number]> = [];
  SERIES.forEach((v, i) => {
    if (v === null) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push([px(i), py(v)]);
  });
  if (run.length) runs.push(run);
  const line = runs.map((r) => r.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("")).join("");
  const area = runs
    .map((r) => `M${r[0][0].toFixed(1)} ${H}` + r.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join("") + `L${r[r.length - 1][0].toFixed(1)} ${H}Z`)
    .join("");
  const last = runs[runs.length - 1][runs[runs.length - 1].length - 1];
  return { line, area, last };
}

type Tone = "great" | "good" | "warn" | "bad";
const TONE: Record<Tone, string> = { great: "bg-emerald-500", good: "bg-lime-500", warn: "bg-amber-400", bad: "bg-red-500" };
const bars = (marks: Record<number, Tone>) => Array.from({ length: 30 }, (_, i): Tone => marks[i] ?? "great");

export function HeroMockup({ t, site }: { t: Translator; site: string }) {
  const { line, area, last } = chartPaths();
  const slack = LANDING_CHANNELS.find((c) => c.type === "slack")!;
  const monitors = [
    { name: t("home.mock.m1"), target: "https://example.com", bars: bars({ 12: "good", 26: "bad" }), value: "99.98%" },
    { name: t("home.mock.m2"), target: "api.example.com/v1", bars: bars({ 5: "good" }), value: "100%" },
    { name: t("home.mock.m3"), target: "0 2 * * *", bars: bars({ 18: "warn" }), value: "99.91%" },
    { name: t("home.mock.m4"), target: "example.com:443", bars: bars({}), value: t("time.days", { n: 54 }) },
  ];
  const kpis = [
    { label: t("home.mock.kpiUptime"), value: "99.98%", trend: "+0.02%" },
    { label: t("home.mock.kpiResponse"), value: t("status.ms", { n: 142 }), trend: "-8%" },
    { label: t("home.mock.kpiIncidents"), value: "0", trend: null },
  ];

  return (
    <div role="img" aria-label={t("home.mock.label", { site })} className="relative mx-auto max-w-[640px] select-none">
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/25 via-emerald-400/10 to-transparent blur-2xl" />

      <div className="animate-tz-pop overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_40px_100px_-36px_rgba(29,91,216,0.5)] ring-1 ring-black/[0.02] motion-reduce:animate-none dark:shadow-[0_40px_100px_-30px_rgba(0,0,0,0.85)]">
        {/* Window bar */}
        <div className="flex items-center gap-3 border-b border-line bg-paper/70 px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="truncate font-display text-sm font-semibold">{t("home.mock.title")}</span>
          <span className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/70 motion-reduce:animate-none" />
              <span className="relative size-1.5 rounded-full bg-emerald-500" />
            </span>
            {t("home.mock.allUp")}
          </span>
        </div>

        <div className="space-y-3 p-3 sm:space-y-4 sm:p-5">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl border border-line bg-paper/60 px-3 py-2.5">
                <p className="truncate text-[10px] font-medium text-muted sm:text-[11px]">{k.label}</p>
                <p className="mt-0.5 flex items-baseline gap-1.5">
                  <bdi className="font-display text-lg font-bold tabular-nums sm:text-xl">{k.value}</bdi>
                  {k.trend ? (
                    <span className="hidden items-center gap-0.5 text-[10px] font-semibold text-emerald-600 sm:inline-flex dark:text-emerald-400" dir="ltr">
                      <TrendingUp className="size-3" aria-hidden />
                      {k.trend}
                    </span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>

          {/* Response time chart */}
          <div className="rounded-xl border border-line bg-paper/60 p-3">
            <div className="flex items-baseline justify-between gap-3 text-[11px]">
              <span className="font-semibold">{t("home.mock.chartTitle")}</span>
              <span className="text-muted">{t("home.mock.chartRange")}</span>
            </div>
            <div className="relative mt-2 h-20 sm:h-24">
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="sz-hero-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--primary)" stopOpacity="0.28" />
                  <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--line)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
              ))}
              <rect x={px(32.5)} width={px(2)} y="0" height={H} className="fill-red-500/15" />
              <line x1={px(33.5)} x2={px(33.5)} y1="4" y2={H} className="stroke-red-500/70" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              <path d={area} fill="url(#sz-hero-area)" />
              <path
                d={line}
                pathLength={1}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="animate-[sz-draw_1.8s_ease-out_0.3s_both] [stroke-dasharray:1] motion-reduce:animate-none"
              />
            </svg>
              <span
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-primary"
                style={{ left: `${(last[0] / W) * 100}%`, top: `${(last[1] / H) * 100}%` }}
              />
            </div>
          </div>

          {/* Monitors */}
          <ul className="divide-y divide-line rounded-xl border border-line">
            {monitors.map((m, i) => (
              <li key={m.name} className="flex items-center gap-3 px-3 py-2.5">
                <span className={cn("relative flex size-2 shrink-0")}>
                  {i === 0 ? <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60 motion-reduce:animate-none" /> : null}
                  <span className="relative size-2 rounded-full bg-emerald-500" />
                </span>
                <span className="min-w-0 flex-1 sm:flex-none sm:basis-36">
                  <span className="block truncate text-[13px] font-semibold">{m.name}</span>
                  <span className="block truncate text-start font-mono text-[10px] text-muted [font-variant-ligatures:none]" dir="ltr">
                    {m.target}
                  </span>
                </span>
                <span className="hidden h-6 flex-1 items-stretch gap-[2px] min-[420px]:flex">
                  {m.bars.map((tone, b) => (
                    <span key={b} className={cn("flex-1 rounded-[2px]", TONE[tone], b < 10 && "max-sm:hidden")} />
                  ))}
                </span>
                <span className="w-14 shrink-0 text-end text-xs font-semibold tabular-nums">
                  <bdi>{m.value}</bdi>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Alert toasts: newest on top, like a notification stack. */}
      <div className="relative z-10 mx-auto -mt-8 flex w-[min(300px,calc(100%-1.5rem))] flex-col gap-2 sm:absolute sm:-bottom-14 sm:-start-8 sm:mx-0 sm:mt-0 lg:-start-12">
        {[
          { icon: CircleCheck, tone: "text-emerald-500", title: t("home.mock.upTitle"), text: t("home.mock.upText"), anim: "animate-[sz-toast-up_10s_ease-in-out_infinite]" },
          { icon: CircleX, tone: "text-red-500", title: t("home.mock.downTitle"), text: t("home.mock.downText"), anim: "animate-[sz-toast-down_10s_ease-in-out_infinite]" },
        ].map((toast) => (
          <div
            key={toast.title}
            className={cn(
              "flex items-start gap-3 rounded-xl border border-line bg-surface/95 p-3 shadow-[0_18px_40px_-16px_rgba(15,23,42,0.35)] backdrop-blur motion-reduce:animate-none dark:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)]",
              toast.anim,
            )}
          >
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-white", slack.tile)}>
              <slack.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 text-[10px] text-muted">
                <span className="truncate font-medium">{t("dash.channel.slack")} · #alerts</span>
                <span className="shrink-0">{t("home.mock.now")}</span>
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold">
                <toast.icon className={cn("size-3.5 shrink-0", toast.tone)} aria-hidden strokeWidth={2.5} />
                <span className="truncate">{toast.title}</span>
              </span>
              <span className="block truncate text-[11px] text-muted">{toast.text}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
