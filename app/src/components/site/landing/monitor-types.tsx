import Link from "next/link";
import { AlarmClock, ArrowRight, CalendarClock, Globe, Network, ScanText, ShieldCheck, Waypoints, type LucideIcon } from "lucide-react";
import type { Translator } from "@/lib/i18n/messages";
import { SectionHeading } from "./section-heading";

type TypeKey = "http" | "keyword" | "tcp" | "ssl" | "domain" | "dns" | "heartbeat";

const TYPES: Array<{ key: TypeKey; icon: LucideIcon; sample: (t: Translator) => string }> = [
  { key: "http", icon: Globe, sample: (t) => `GET /health → 200 · ${t("status.ms", { n: 142 })}` },
  { key: "keyword", icon: ScanText, sample: () => `contains "In stock"` },
  { key: "tcp", icon: Network, sample: () => "db.example.com:5432" },
  { key: "ssl", icon: ShieldCheck, sample: (t) => `example.com:443 · ${t("time.days", { n: 54 })}` },
  { key: "domain", icon: CalendarClock, sample: (t) => `example.com · ${t("time.days", { n: 212 })}` },
  { key: "dns", icon: Waypoints, sample: () => "A → 203.0.113.10" },
  { key: "heartbeat", icon: AlarmClock, sample: () => "0 2 * * *  /api/ping/…" },
];

export function MonitorTypes({ t, signedIn }: { t: Translator; signedIn: boolean }) {
  return (
    <section id="features" aria-labelledby="types-title" className="scroll-mt-16 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading id="types-title" eyebrow={t("home.typesEyebrow")} title={t("home.typesTitle")} text={t("home.typesText")} />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TYPES.map(({ key, icon: Icon, sample }) => (
            <li
              key={key}
              className="group relative flex flex-col rounded-2xl border border-line bg-surface p-6 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary-line hover:shadow-[0_20px_40px_-28px_var(--primary)] motion-reduce:hover:translate-y-0"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary-text ring-1 ring-primary-line/40 transition-colors group-hover:bg-primary group-hover:text-white">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-bold">{t(`home.type.${key}Title`)}</h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{t(`home.type.${key}Text`)}</p>
              <p className="mt-5 flex items-center gap-2 overflow-hidden rounded-lg border border-line bg-paper px-2.5 py-1.5 font-mono text-[11px] text-muted [font-variant-ligatures:none]" dir="ltr">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span className="truncate">{sample(t)}</span>
              </p>
            </li>
          ))}
          <li className="relative flex flex-col overflow-hidden rounded-2xl bg-primary p-6 text-white shadow-[0_24px_48px_-28px_var(--primary)]">
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]"
            />
            <span aria-hidden className="relative flex flex-wrap gap-1.5">
              {TYPES.map(({ key, icon: Icon }) => (
                <span key={key} className="grid size-8 place-items-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <Icon className="size-4" />
                </span>
              ))}
            </span>
            <h3 className="relative mt-5 text-lg font-bold">{t("home.typesCtaTitle")}</h3>
            <p className="relative mt-1.5 flex-1 text-sm leading-relaxed text-white/80">{t("home.typesCtaText")}</p>
            <Link
              href={signedIn ? "/dashboard" : "/register"}
              className="group relative mt-6 inline-flex items-center gap-1.5 self-start rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-white/90"
            >
              {signedIn ? t("nav.dashboard") : t("home.ctaStart")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
