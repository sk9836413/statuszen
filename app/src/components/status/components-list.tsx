import { ChevronDown } from "lucide-react";
import type { Translator } from "@/lib/i18n/messages";
import { worstState, type PublicComponent } from "@/lib/status-view";
import { cn } from "@/lib/utils";
import { formatPercent } from "./format";
import { Sparkline } from "./sparkline";
import { StateLabel } from "./state";
import { UptimeBars, type Bar, type BarLabels } from "./uptime-bars";

/** Axis labels follow the responsive bar window (30 days on phones, 60 on small tablets, 90 above). */
function axisClass(window: number, days: number): string {
  if (window === 30) return days === 30 ? "flex" : "flex sm:hidden";
  if (window === 60) return days === 60 ? "hidden sm:flex" : "hidden sm:flex md:hidden";
  return "hidden md:flex";
}

function ComponentRow({
  component,
  t,
  locale,
  days,
  showUptime,
  labels,
}: {
  component: PublicComponent;
  t: Translator;
  locale: string;
  days: number;
  showUptime: boolean;
  labels: Omit<BarLabels, "group">;
}) {
  const bars: Bar[] = component.days.map((d) => [d.day, d.uptime, d.downtimeSec, d.incidents]);
  const windows = ([30, 60, 90] as const).filter((w) => w <= days);
  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h3 dir="auto" className="min-w-0 truncate font-medium text-ink">{component.name}</h3>
        <div className="flex shrink-0 items-center gap-3">
          {component.response ? (
            <span className="hidden items-center gap-2 sm:flex">
              <Sparkline
                points={component.response.points}
                label={t("status.responseAvg", { n: component.response.avgMs ?? 0 })}
                className="h-6 w-20 opacity-90"
              />
              <span className="w-14 text-end font-mono text-xs text-muted tabular-nums" aria-hidden>
                <bdi>{t("status.ms", { n: component.response.avgMs ?? 0 })}</bdi>
              </span>
            </span>
          ) : null}
          <StateLabel state={component.state} label={t(`status.state.${component.state}`)} />
        </div>
      </div>
      {bars.length ? (
        <div className="mt-3">
          <UptimeBars bars={bars} locale={locale} labels={{ ...labels, group: t("status.barsLabel", { name: component.name, n: days }) }} />
          <div className="mt-2 text-xs text-muted">
            {windows.map((w) => (
              <div key={w} className={cn("items-center gap-3", axisClass(w, days))}>
                <span className="shrink-0">{t("status.daysAgo", { n: w })}</span>
                <span aria-hidden className="h-px flex-1 bg-line" />
                {showUptime ? (
                  <>
                    <span className="shrink-0 font-medium text-ink/80 tabular-nums">
                      {t("status.uptimeFor", { percent: formatPercent(component.uptime[w] ?? null, locale) })}
                    </span>
                    <span aria-hidden className="h-px flex-1 bg-line" />
                  </>
                ) : null}
                <span className="shrink-0">{t("status.today")}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** All components: ungrouped first, then each group as a collapsible block. */
export function ComponentsList({
  components,
  t,
  locale,
  days,
  showUptime,
}: {
  components: PublicComponent[];
  t: Translator;
  locale: string;
  days: number;
  showUptime: boolean;
}) {
  const labels: Omit<BarLabels, "group"> = {
    noData: t("status.bar.noData"),
    uptime: t("status.bar.uptime"),
    down: t("status.bar.down"),
    noDowntime: t("status.bar.noDowntime"),
    oneIncident: t("status.bar.oneIncident"),
    incidents: t("status.bar.incidents"),
    units: { s: t("time.seconds"), m: t("time.minutes"), h: t("time.hours"), d: t("time.days") },
  };
  const ungrouped = components.filter((c) => !c.group);
  const groups = new Map<string, PublicComponent[]>();
  for (const c of components) if (c.group) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
  const row = (c: PublicComponent) => (
    <ComponentRow key={c.monitorId} component={c} t={t} locale={locale} days={days} showUptime={showUptime} labels={labels} />
  );

  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
      {ungrouped.map(row)}
      {[...groups].map(([name, items]) => {
        const state = worstState(items.map((c) => c.state));
        return (
          <details key={name} open className="group/g">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 select-none sm:px-6 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-2.5">
                <ChevronDown className="size-4 shrink-0 text-muted transition-transform -rotate-90 rtl:rotate-90 group-open/g:rotate-0 rtl:group-open/g:rotate-0" aria-hidden />
                <span dir="auto" className="truncate font-semibold text-ink">{name}</span>
                <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-muted tabular-nums">{items.length}</span>
              </span>
              <StateLabel state={state} label={t(`status.state.${state}`)} compact />
            </summary>
            <div className="divide-y divide-line border-t border-line bg-paper/40 dark:bg-paper/30">{items.map(row)}</div>
          </details>
        );
      })}
    </div>
  );
}
