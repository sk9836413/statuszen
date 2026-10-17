import type { ReactNode } from "react";
import {
  CalendarClock,
  Globe,
  Hash,
  HeartPulse,
  LockKeyhole,
  Mail,
  MessagesSquare,
  Network,
  Send,
  Server,
  TextSearch,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import type { ChannelType, Impact, IncidentStatus, MonitorStatus, MonitorType } from "@/monitor/types";
import { cn } from "@/lib/utils";

/**
 * Icons, colours and small badges for monitor types, statuses, channels and
 * incidents. No hooks: labels are passed in, so these render on the server
 * and inside client components alike.
 */

export const TYPE_ICONS: Record<MonitorType, LucideIcon> = {
  http: Globe,
  keyword: TextSearch,
  tcp: Network,
  ssl: LockKeyhole,
  domain: CalendarClock,
  dns: Server,
  heartbeat: HeartPulse,
};

export const CHANNEL_ICONS: Record<ChannelType, LucideIcon> = {
  email: Mail,
  webhook: Webhook,
  slack: Hash,
  discord: MessagesSquare,
  telegram: Send,
  teams: Users,
};

const STATUS_DOT: Record<MonitorStatus, string> = {
  up: "bg-emerald-500",
  down: "bg-red-500",
  paused: "bg-gray-400 dark:bg-gray-500",
  maintenance: "bg-blue-500",
  pending: "bg-gray-300 dark:bg-gray-600",
};

const STATUS_TEXT: Record<MonitorStatus, string> = {
  up: "text-emerald-700 dark:text-emerald-400",
  down: "text-red-700 dark:text-red-400",
  paused: "text-muted",
  maintenance: "text-blue-700 dark:text-blue-400",
  pending: "text-muted",
};

const STATUS_BADGE: Record<MonitorStatus, string> = {
  up: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  down: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  paused: "bg-line/70 text-muted",
  maintenance: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  pending: "bg-line/70 text-muted",
};

export function statusTextClass(status: MonitorStatus): string {
  return STATUS_TEXT[status];
}

/** Coloured status dot. Down monitors get a soft pulse so problems stand out. */
export function StatusDot({ status, size = "md", className }: { status: MonitorStatus; size?: "sm" | "md" | "lg"; className?: string }) {
  const dim = size === "lg" ? "size-4" : size === "sm" ? "size-2" : "size-2.5";
  return (
    <span className={cn("relative inline-flex shrink-0", dim, className)} aria-hidden>
      {status === "down" ? <span className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping", STATUS_DOT[status])} /> : null}
      <span className={cn("relative inline-flex rounded-full", dim, STATUS_DOT[status])} />
    </span>
  );
}

export function StatusBadge({ status, label, className }: { status: MonitorStatus; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_BADGE[status], className)}>
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
      {label}
    </span>
  );
}

export function TypeBadge({ type, label, className }: { type: MonitorType; label: string; className?: string }) {
  const Icon = TYPE_ICONS[type];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border border-line bg-paper px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-muted", className)}>
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}

export function ChannelIcon({ type, className }: { type: ChannelType; className?: string }) {
  const Icon = CHANNEL_ICONS[type];
  return <Icon className={cn("size-4", className)} aria-hidden />;
}

const INCIDENT_BADGE: Record<IncidentStatus, string> = {
  investigating: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  identified: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  monitoring: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

export function IncidentStatusBadge({ status, label }: { status: IncidentStatus; label: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", INCIDENT_BADGE[status])}>{label}</span>;
}

const IMPACT_DOT: Record<Impact, string> = {
  none: "bg-gray-400",
  minor: "bg-amber-500",
  major: "bg-orange-500",
  critical: "bg-red-600",
  maintenance: "bg-blue-500",
};

export function ImpactBadge({ impact, label }: { impact: Impact; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs font-medium whitespace-nowrap text-muted">
      <span className={cn("size-1.5 rounded-full", IMPACT_DOT[impact])} aria-hidden />
      {label}
    </span>
  );
}

/** Square icon tile used in list rows and cards. */
export function IconTile({ children, tone = "primary", className }: { children: ReactNode; tone?: "primary" | "neutral"; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-[18px]",
        tone === "primary" ? "bg-primary-soft text-primary" : "bg-paper text-muted ring-1 ring-line",
        className,
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}
