import { BellRing, Globe, Share2 } from "lucide-react";
import type { Translator } from "@/lib/i18n/messages";
import { SectionHeading } from "./section-heading";

export function HowItWorks({ t }: { t: Translator }) {
  const steps = [
    { icon: Globe, title: t("home.step1Title"), text: t("home.step1") },
    { icon: BellRing, title: t("home.step2Title"), text: t("home.step2") },
    { icon: Share2, title: t("home.step3Title"), text: t("home.step3") },
  ];
  return (
    <section aria-labelledby="steps-title" className="py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading id="steps-title" align="center" eyebrow={t("home.stepsEyebrow")} title={t("home.stepsTitle")} />
        <div className="relative mt-14">
          <span aria-hidden className="absolute inset-x-[16%] top-[2.1rem] hidden border-t-2 border-dashed border-primary-line md:block" />
          <ol className="relative grid gap-12 md:grid-cols-3 md:gap-5">
            {steps.map((s, i) => (
              <li key={s.title} className="relative flex flex-col items-center rounded-2xl px-4 text-center">
                <span className="relative grid size-[4.25rem] place-items-center rounded-2xl border border-line bg-surface text-primary-text shadow-[0_12px_30px_-18px_var(--primary)]">
                  <s.icon className="size-7" aria-hidden strokeWidth={1.75} />
                  <span className="absolute -end-2 -top-2 grid size-6 place-items-center rounded-full bg-primary font-display text-xs font-bold text-white ring-4 ring-paper">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-6 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
