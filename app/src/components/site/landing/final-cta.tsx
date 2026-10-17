import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Translator } from "@/lib/i18n/messages";

export function FinalCta({ t, signedIn }: { t: Translator; signedIn: boolean }) {
  return (
    <section aria-labelledby="cta-title" className="px-4 pt-4 pb-24 sm:px-6">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-primary px-6 py-16 text-center text-white shadow-[0_40px_80px_-40px_var(--primary)] sm:px-12 sm:py-20">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
        />
        <div aria-hidden className="absolute inset-x-0 -top-40 mx-auto h-72 max-w-2xl rounded-full bg-white/25 blur-[100px]" />
        <div aria-hidden className="absolute -end-16 -bottom-24 size-72 rounded-full bg-emerald-300/30 blur-[100px]" />
        {/* A row of uptime bars as a quiet visual signature. */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 flex h-10 items-end justify-center gap-[3px] opacity-25">
          {Array.from({ length: 64 }, (_, i) => (
            <span key={i} className="w-1.5 rounded-t-sm bg-white" style={{ height: `${40 + ((i * 53) % 60)}%` }} />
          ))}
        </div>
        <div className="relative">
          <h2 id="cta-title" className="mx-auto max-w-[22ch] text-3xl leading-[1.08] font-bold tracking-tight sm:text-5xl">
            {t("home.ctaTitle")}
          </h2>
          <p className="mx-auto mt-5 max-w-[48ch] text-lg text-white/80">{t("home.ctaText")}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href={signedIn ? "/dashboard" : "/register"}
              className="group inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 font-semibold text-primary shadow-lg shadow-black/10 transition-colors hover:bg-white/90"
            >
              {signedIn ? t("nav.dashboard") : t("home.ctaStart")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-lg px-6 font-semibold text-white ring-1 ring-white/40 transition-colors ring-inset hover:bg-white/10"
            >
              {t("home.ctaPricing")}
            </Link>
          </div>
          <p className="mt-5 text-sm text-white/75">{t("home.noCard")}</p>
        </div>
      </div>
    </section>
  );
}
