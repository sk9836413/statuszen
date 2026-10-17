"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Pause, Play, Search, SearchX } from "lucide-react";
import { bulkMonitorsAction } from "@/app/actions/dashboard/monitors";
import { initialFormState, type FormState } from "@/app/actions/types";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { MONITOR_TYPES, type MonitorStatus, type MonitorType } from "@/monitor/types";
import { Sparkline } from "./charts";
import { StatusDot, TypeBadge } from "./monitor-meta";

export interface MonitorListItem {
  id: number;
  name: string;
  type: MonitorType;
  target: string;
  status: MonitorStatus;
  uptime: string;
  uptimeTone: "none" | "good" | "ok" | "warn" | "bad";
  response: string;
  lastCheck: string;
  interval: string;
  spark: Array<number | null>;
  failures: number[];
}

const UPTIME_TEXT: Record<MonitorListItem["uptimeTone"], string> = {
  none: "text-muted",
  good: "text-emerald-700 dark:text-emerald-400",
  ok: "text-lime-700 dark:text-lime-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-red-700 dark:text-red-400",
};

const STATUS_FILTERS = ["all", "up", "down", "paused", "pending"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export function MonitorRows({
  items,
  selectable = false,
  selected,
  onToggle,
  compact = false,
}: {
  items: MonitorListItem[];
  selectable?: boolean;
  selected?: Set<number>;
  onToggle?: (id: number) => void;
  /** Narrow container (overview): fewer columns. */
  compact?: boolean;
}) {
  const t = useT();
  return (
    <ul className="divide-y divide-line">
      {items.map((m) => (
        <li key={m.id} className="group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-paper sm:gap-4 sm:px-5">
          {selectable ? (
            <input
              type="checkbox"
              className="relative z-10 size-4 shrink-0 accent-[var(--primary)]"
              checked={selected?.has(m.id) ?? false}
              onChange={() => onToggle?.(m.id)}
              aria-label={t("dash.monitors.select", { name: m.name })}
            />
          ) : null}
          <StatusDot status={m.status} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={`/dashboard/monitors/${m.id}`}
                dir="auto"
                className="truncate font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-primary focus-visible:after:ring-inset"
              >
                {m.name}
              </Link>
              <TypeBadge type={m.type} label={t(`dash.type.${m.type}` as MessageKey)} className={compact ? "max-2xl:hidden" : "max-sm:hidden"} />
            </div>
            <p className="truncate text-xs text-muted">
              <span className="sr-only">{t(`dash.status.${m.status}` as MessageKey)} · </span>
              <span dir="ltr">{m.target}</span>
              <span className="max-sm:hidden"> · {m.interval}</span>
            </p>
          </div>
          <div className="w-28 shrink-0 max-md:hidden">
            <Sparkline points={m.spark} failures={m.failures} label={t("dash.monitors.sparkLabel", { name: m.name })} />
          </div>
          <div className="w-20 shrink-0 text-end">
            <p className={cn("text-sm font-semibold tabular-nums", UPTIME_TEXT[m.uptimeTone])}>{m.uptime}</p>
            <p className="text-[11px] text-muted">{t("dash.monitors.uptime24")}</p>
          </div>
          <div className="w-20 shrink-0 text-end max-sm:hidden">
            <p className="text-sm tabular-nums">{m.response}</p>
            <p className="text-[11px] text-muted">{t("dash.monitors.response")}</p>
          </div>
          <div className={cn("w-28 shrink-0 text-end", compact ? "max-xl:hidden" : "max-lg:hidden")}>
            <p className="truncate text-sm">{m.lastCheck}</p>
            <p className="text-[11px] text-muted">{t("dash.monitors.lastCheck")}</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
        </li>
      ))}
    </ul>
  );
}

/** Monitors page list: search, status/type filters and bulk pause/resume. */
export function MonitorList({ items }: { items: MonitorListItem[] }) {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<MonitorType | "all">("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<FormState>(initialFormState);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: items.length, up: 0, down: 0, paused: 0, pending: 0 };
    for (const m of items) if (m.status in c) c[m.status as StatusFilter] += 1;
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (m) =>
        (status === "all" || m.status === status) &&
        (type === "all" || m.type === type) &&
        (!q || m.name.toLowerCase().includes(q) || m.target.toLowerCase().includes(q)),
    );
  }, [items, query, status, type]);

  const visibleSelected = visible.filter((m) => selected.has(m.id));
  const allChecked = visible.length > 0 && visibleSelected.length === visible.length;

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulk = (op: "pause" | "resume") => {
    const fd = new FormData();
    fd.set("op", op);
    for (const m of visibleSelected) fd.append("ids", String(m.id));
    startTransition(async () => {
      const r = await bulkMonitorsAction(initialFormState, fd);
      setResult(r);
      if (!r.error) setSelected(new Set());
      router.refresh();
    });
  };

  const usedTypes = MONITOR_TYPES.filter((ty) => items.some((m) => m.type === ty));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("dash.monitors.search")}
            aria-label={t("dash.monitors.search")}
            className="h-9 w-full rounded-lg border border-line bg-surface ps-9 pe-3 text-sm placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
          />
        </div>
        <div className="w-full sm:w-44">
        <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label={t("dash.monitors.filterStatus")} className="h-9">
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? t("dash.monitors.allStatuses") : t(`dash.status.${s}` as MessageKey)} ({counts[s]})
            </option>
          ))}
        </Select>
        </div>
        {usedTypes.length > 1 ? (
          <div className="w-full sm:w-44">
          <Select value={type} onChange={(e) => setType(e.target.value as MonitorType | "all")} aria-label={t("dash.monitors.filterType")} className="h-9">
            <option value="all">{t("dash.monitors.allTypes")}</option>
            {usedTypes.map((ty) => (
              <option key={ty} value={ty}>
                {t(`dash.type.${ty}` as MessageKey)}
              </option>
            ))}
          </Select>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-12 flex-wrap items-center gap-3 border-b border-line bg-paper/60 px-4 py-2 sm:px-5">
        <label className="inline-flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={allChecked}
            disabled={!visible.length}
            onChange={() => setSelected(allChecked ? new Set() : new Set(visible.map((m) => m.id)))}
          />
          {visibleSelected.length ? t("dash.monitors.selected", { n: visibleSelected.length }) : t("dash.monitors.selectAll")}
        </label>
        {visibleSelected.length ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => bulk("pause")} disabled={pending}>
              <Pause aria-hidden />
              {t("dash.monitor.pause")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk("resume")} disabled={pending}>
              <Play aria-hidden />
              {t("dash.monitor.resume")}
            </Button>
          </div>
        ) : null}
        <p role="status" className={cn("ms-auto text-sm", result.error ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
          {result.error ?? result.success ?? ""}
        </p>
      </div>

      {visible.length ? (
        <MonitorRows items={visible} selectable selected={selected} onToggle={toggle} />
      ) : (
        <div className="px-6 py-12 text-center">
          <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-primary-soft text-primary">
            <SearchX className="size-5" aria-hidden />
          </div>
          <p className="font-medium">{t("dash.monitors.noMatch")}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              setQuery("");
              setStatus("all");
              setType("all");
            }}
          >
            {t("dash.monitors.clearFilters")}
          </Button>
        </div>
      )}
    </div>
  );
}
