import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Centered message card for the confirm / unsubscribe pages. */
export function NoticeCard({
  icon: Icon,
  tone,
  title,
  children,
  backHref,
  backLabel,
}: {
  icon: LucideIcon;
  tone: "success" | "error" | "neutral";
  title: string;
  children?: ReactNode;
  backHref: string;
  backLabel: string;
}) {
  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-16">
      <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]">
        <span
          className={cn(
            "mx-auto grid size-14 place-items-center rounded-full ring-8",
            tone === "success" && "bg-emerald-500 text-white ring-emerald-500/15",
            tone === "error" && "bg-red-500 text-white ring-red-500/15",
            tone === "neutral" && "bg-primary text-white ring-primary-soft",
          )}
        >
          <Icon className="size-7" aria-hidden strokeWidth={2.25} />
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        <div className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{children}</div>
        <Link href={backHref} className="mt-6 inline-flex text-sm font-medium text-primary-text hover:underline hover:underline-offset-4">
          {backLabel}
        </Link>
      </div>
    </main>
  );
}
