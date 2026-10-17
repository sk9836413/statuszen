import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Alerts } from "@/components/site/landing/alerts";
import { Faq } from "@/components/site/landing/faq";
import { FinalCta } from "@/components/site/landing/final-cta";
import { Heartbeat } from "@/components/site/landing/heartbeat";
import { Hero, ProofStrip } from "@/components/site/landing/hero";
import { HowItWorks } from "@/components/site/landing/how-it-works";
import { MonitorTypes } from "@/components/site/landing/monitor-types";
import { PricingTeaser, type TeaserPlan } from "@/components/site/landing/pricing-teaser";
import { loadShowcase, StatusShowcase } from "@/components/site/landing/status-showcase";
import { PostCard } from "@/components/site/post-card";
import { getLatestPosts } from "@/lib/blog";
import { getT, localSetting } from "@/lib/i18n/server";
import { getActivePlans } from "@/lib/plans";
import { absoluteUrl, getSiteContext } from "@/lib/site";
import { formatInterval } from "@/monitor/format";

export default async function HomePage() {
  const { settings, user, blogVisible, locale } = await getSiteContext();
  const [t, heroTitle, heroSubtitle, posts, plans, showcase] = await Promise.all([
    getT(),
    localSetting(settings, "home_hero_title"),
    localSetting(settings, "home_hero_subtitle"),
    blogVisible ? getLatestPosts(3) : Promise.resolve([]),
    getActivePlans(),
    loadShowcase(settings.showcase_status_slug),
  ]);

  const signedIn = Boolean(user);
  // The fastest check interval any active plan offers (used in the hero, stats and FAQ).
  const intervals = plans.map((p) => p.min_interval_sec).filter((s) => s > 0);
  const interval = formatInterval(intervals.length ? Math.min(...intervals) : 60, t);
  const teaserPlans: TeaserPlan[] = plans.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    priceMonthly: p.price_monthly,
    isFree: p.is_free === 1,
    isFeatured: p.is_featured === 1,
    maxMonitors: p.max_monitors,
    minIntervalSec: p.min_interval_sec,
    maxStatusPages: p.max_status_pages,
  }));
  const host = absoluteUrl(settings).replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <>
      <Hero t={t} title={heroTitle} subtitle={heroSubtitle} signedIn={signedIn} interval={interval} site={settings.site_name} />
      <ProofStrip t={t} showStats={settings.show_stats_on_home} interval={interval} />
      <MonitorTypes t={t} signedIn={signedIn} />
      <Alerts t={t} />
      <StatusShowcase t={t} live={showcase} host={host} locale={locale.code} />
      <Heartbeat t={t} pingUrl={absoluteUrl(settings, "/api/ping/YOUR_TOKEN")} />
      <HowItWorks t={t} />
      <PricingTeaser t={t} plans={teaserPlans} currency={settings.currency} locale={locale.code} />
      <Faq t={t} interval={interval} contact={settings.contact_enabled} />

      {posts.length ? (
        <section aria-labelledby="posts-title" className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="posts-title" className="text-3xl font-bold tracking-tight">
              {t("home.latestPosts")}
            </h2>
            <Link href="/blog" className="group inline-flex items-center gap-1.5 font-semibold text-primary-text hover:underline">
              {t("home.allPosts")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
            </Link>
          </div>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} readMore={t("blog.readMore")} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <FinalCta t={t} signedIn={signedIn} />
    </>
  );
}
