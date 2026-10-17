"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { BAR_CLASS, barTone, formatDay, formatPercent, formatSeconds } from "./format";

export interface BarLabels {
  group: string;
  noData: string;
  /** "{percent} uptime" */
  uptime: string;
  /** "Down for {duration}" */
  down: string;
  noDowntime: string;
  oneIncident: string;
  /** "{n} incidents" */
  incidents: string;
  units: { s: string; m: string; h: string; d: string };
}

/** Compact day: day, uptime (null = no data), downtime seconds, incident titles. */
export type Bar = [day: string, uptime: number | null, downtimeSec: number, incidents: string[]];

const TOOLTIP_WIDTH = 240;

/** Responsive window: phones show 30 days, small tablets 60, larger screens all 90. */
function visibility(age: number): string {
  if (age >= 60) return "hidden md:block";
  if (age >= 30) return "hidden sm:block";
  return "block";
}

export function UptimeBars({ bars, locale, labels }: { bars: Bar[]; locale: string; labels: BarLabels }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [active, setActive] = useState(bars.length - 1);
  const [shown, setShown] = useState<number | null>(null);
  const [pos, setPos] = useState({ left: 0, width: TOOLTIP_WIDTH, arrow: TOOLTIP_WIDTH / 2 });

  const show = useCallback((i: number) => {
    const wrap = wrapRef.current;
    const bar = barRefs.current[i];
    if (wrap && bar) {
      const w = wrap.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      const center = b.left - w.left + b.width / 2;
      const width = Math.min(TOOLTIP_WIDTH, w.width);
      const left = Math.min(Math.max(center - width / 2, 0), w.width - width);
      setPos({ left, width, arrow: Math.min(Math.max(center - left, 10), width - 10) });
    }
    setShown(i);
  }, []);

  const describe = (bar: Bar) => {
    const [day, uptime, downtime, incidents] = bar;
    const parts = [formatDay(day, locale)];
    if (uptime === null) parts.push(labels.noData);
    else {
      parts.push(labels.uptime.replace("{percent}", formatPercent(uptime, locale)));
      parts.push(downtime > 0 ? labels.down.replace("{duration}", formatSeconds(downtime, labels.units)) : labels.noDowntime);
    }
    if (incidents.length) parts.push(incidents.length === 1 ? labels.oneIncident : labels.incidents.replace("{n}", String(incidents.length)));
    return parts.join(", ");
  };

  const visibleIndexes = () => barRefs.current.map((el, i) => (el && el.getClientRects().length ? i : -1)).filter((i) => i >= 0);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setShown(null);
      return;
    }
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const visible = visibleIndexes();
    if (!visible.length) return;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    let at = visible.indexOf(active);
    if (at < 0) at = visible.length - 1;
    if (e.key === "Home") at = 0;
    else if (e.key === "End") at = visible.length - 1;
    else {
      const forward = (e.key === "ArrowRight") !== rtl;
      at = Math.min(visible.length - 1, Math.max(0, at + (forward ? 1 : -1)));
    }
    const next = visible[at];
    setActive(next);
    barRefs.current[next]?.focus();
  };

  const current = shown === null ? null : bars[shown];

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseLeave={() => {
        if (!wrapRef.current?.contains(document.activeElement)) setShown(null);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setShown(null);
      }}
      onKeyDown={onKeyDown}
    >
      <div role="group" aria-label={labels.group} className="flex h-9 items-stretch gap-[3px] sm:gap-[2px] md:gap-[3px]">
        {bars.map((bar, i) => (
          <button
            key={bar[0]}
            ref={(el) => {
              barRefs.current[i] = el;
            }}
            type="button"
            tabIndex={i === active ? 0 : -1}
            aria-label={describe(bar)}
            onMouseEnter={() => show(i)}
            onFocus={() => {
              setActive(i);
              show(i);
            }}
            onClick={() => show(i)}
            className={cn(
              "min-w-0 flex-1 cursor-default rounded-[3px] transition-[opacity,transform] duration-150 outline-offset-1 hover:opacity-75 focus-visible:outline-2",
              BAR_CLASS[barTone(bar[1])],
              visibility(bars.length - 1 - i),
              shown === i && "opacity-75",
            )}
          />
        ))}
      </div>
      {current ? (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-full z-30 mb-2.5 rounded-xl border border-line bg-surface p-3 text-start text-sm shadow-[0_12px_32px_-8px_rgba(15,23,42,0.28)] dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.7)]"
          style={{ left: pos.left, width: pos.width }}
        >
          <p className="font-semibold text-ink">{formatDay(current[0], locale, { dateStyle: "full" })}</p>
          {current[1] === null ? (
            <p className="mt-1 text-muted">{labels.noData}</p>
          ) : (
            <div className="mt-1.5 space-y-1">
              <p className="flex items-center gap-2 text-ink">
                <span aria-hidden className={cn("size-2 rounded-full", BAR_CLASS[barTone(current[1])])} />
                <span className="tabular-nums">{labels.uptime.replace("{percent}", formatPercent(current[1], locale))}</span>
              </p>
              <p className="text-muted">
                {current[2] > 0 ? labels.down.replace("{duration}", formatSeconds(current[2], labels.units)) : labels.noDowntime}
              </p>
            </div>
          )}
          {current[3].length ? (
            <div className="mt-2 border-t border-line pt-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {current[3].length === 1 ? labels.oneIncident : labels.incidents.replace("{n}", String(current[3].length))}
              </p>
              <ul className="mt-1 space-y-0.5">
                {current[3].slice(0, 3).map((title, i) => (
                  <li key={i} className="flex gap-2 text-ink">
                    <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-red-500" />
                    <span className="line-clamp-2">{title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <span
            aria-hidden
            className="absolute top-full -mt-[5px] size-2.5 -translate-x-1/2 rotate-45 border-r border-b border-line bg-surface"
            style={{ left: pos.arrow }}
          />
        </div>
      ) : null}
    </div>
  );
}
