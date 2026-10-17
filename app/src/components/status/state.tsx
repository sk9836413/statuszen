import { CircleAlert, CircleCheck, CircleMinus, CircleX, TriangleAlert, Wrench, type LucideIcon } from "lucide-react";
import type { ComponentState } from "@/lib/status-view";
import type { Impact } from "@/monitor/types";
import { cn } from "@/lib/utils";

interface Tone {
  icon: LucideIcon;
  /** Solid colour (dots, icon discs). */
  solid: string;
  /** Coloured text that reads well on the surface in both themes. */
  text: string;
  /** Tinted panel background + border. */
  panel: string;
  /** Soft ring around the icon disc. */
  ring: string;
}

export const STATE_TONE: Record<ComponentState, Tone> = {
  operational: {
    icon: CircleCheck,
    solid: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    panel: "border-emerald-500/25 bg-emerald-500/[0.07] dark:bg-emerald-500/10",
    ring: "ring-emerald-500/20",
  },
  degraded: {
    icon: TriangleAlert,
    solid: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    panel: "border-amber-500/30 bg-amber-500/[0.08] dark:bg-amber-500/10",
    ring: "ring-amber-500/25",
  },
  partial_outage: {
    icon: CircleAlert,
    solid: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-400",
    panel: "border-orange-500/30 bg-orange-500/[0.08] dark:bg-orange-500/10",
    ring: "ring-orange-500/25",
  },
  major_outage: {
    icon: CircleX,
    solid: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
    panel: "border-red-500/30 bg-red-500/[0.07] dark:bg-red-500/10",
    ring: "ring-red-500/25",
  },
  maintenance: {
    icon: Wrench,
    solid: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-400",
    panel: "border-blue-500/25 bg-blue-500/[0.07] dark:bg-blue-500/10",
    ring: "ring-blue-500/20",
  },
  paused: {
    icon: CircleMinus,
    solid: "bg-slate-400",
    text: "text-muted",
    panel: "border-line bg-surface",
    ring: "ring-slate-400/20",
  },
  unknown: {
    icon: CircleMinus,
    solid: "bg-slate-400",
    text: "text-muted",
    panel: "border-line bg-surface",
    ring: "ring-slate-400/20",
  },
};

/** Incident impact → the component state colours it is shown with. */
export const IMPACT_STATE: Record<Impact, ComponentState> = {
  none: "unknown",
  minor: "degraded",
  major: "partial_outage",
  critical: "major_outage",
  maintenance: "maintenance",
};

/** Small coloured icon + label, e.g. "✓ Operational". */
export function StateLabel({ state, label, compact, className }: { state: ComponentState; label: string; compact?: boolean; className?: string }) {
  const tone = STATE_TONE[state];
  const Icon = tone.icon;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-sm font-medium", tone.text, className)} title={compact ? label : undefined}>
      <Icon className="size-4" aria-hidden strokeWidth={2.25} />
      {/* Compact labels show only the icon on phones. */}
      <span className={compact ? "sr-only sm:not-sr-only" : undefined}>{label}</span>
    </span>
  );
}

/** Coloured dot (decorative). */
export function StateDot({ state, className }: { state: ComponentState; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", STATE_TONE[state].solid, className)} />;
}
