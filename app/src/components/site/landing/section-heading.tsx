import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Eyebrow + title + intro used by every landing section. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  text,
  align = "start",
  className,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  text?: ReactNode;
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <p className={cn("inline-flex items-center gap-2 text-sm font-semibold text-primary-text", align === "center" && "justify-center")}>
        <span aria-hidden className="size-1.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
        {eyebrow}
      </p>
      <h2 id={id} className="mt-3 text-3xl leading-[1.1] font-bold tracking-tight sm:text-[2.6rem]">
        {title}
      </h2>
      {text ? <p className="mt-4 text-lg leading-relaxed text-muted">{text}</p> : null}
    </div>
  );
}
