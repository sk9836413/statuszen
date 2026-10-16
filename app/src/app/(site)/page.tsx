import { Activity, AlarmClock, BellRing, Globe, ShieldCheck, Siren } from "lucide-react";
import { PostCard } from "@/components/site/post-card";
import { ButtonLink } from "@/components/ui/button";
import { getLatestPosts } from "@/lib/blog";
import { getT, localSetting } from "@/lib/i18n/server";
import { getSiteContext } from "@/lib/site";

const FEATURES = [
  { icon: Globe, title: "home.f.uptimeTitle", text: "home.f.uptimeText" },
  { icon: AlarmClock, title: "home.f.cronTitle", text: "home.f.cronText" },
  { icon: ShieldCheck, title: "home.f.sslTitle", text: "home.f.sslText" },
  { icon: BellRing, title: "home.f.alertsTitle", text: "home.f.alertsText" },
  { icon: Activity, title: "home.f.statusTitle", text: "home.f.statusText" },
  { icon: Siren, title: "home.f.incidentsTitle", text: "home.f.incidentsText" },
] as const;

export default async function HomePage() {
  const { settings, user, blogVisible } = await getSiteContext();
  const [t, heroTitle, heroSubtitle, posts] = await Promise.all([
    getT(),
    localSetting(settings, "home_hero_title"),
    localSetting(settings, "home_hero_subtitle"),
    blogVisible ? getLatestPosts(3) : Promise.resolve([]),
  ]);

  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div className="mat-grid mat-grid-fade absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <h1 className="text-4xl leading-[1.05] font-bold text-balance sm:text-6xl">{heroTitle}</h1>
          <p className="mx-auto mt-6 max-w-[60ch] text-lg leading-relaxed text-muted">{heroSubtitle}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href={user ? "/dashboard" : "/register"} size="lg">
              {user ? t("nav.dashboard") : t("home.ctaStart")}
            </ButtonLink>
            <ButtonLink href="/pricing" size="lg" variant="outline">
              {t("home.ctaPricing")}
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-muted">{t("home.noCard")}</p>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 pt-20 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold sm:text-4xl">{t("home.featuresTitle")}</h2>
          <p className="mt-3 text-lg text-muted">{t("home.featuresText")}</p>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-xl border border-line bg-surface p-6">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <f.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-bold">{t(f.title)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(f.text)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <h2 className="text-3xl font-bold">{t("home.stepsTitle")}</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {(["home.step1", "home.step2", "home.step3"] as const).map((key, i) => (
            <li key={key} className="rounded-xl border border-line bg-surface p-6">
              <span className="font-display text-3xl font-bold text-primary">{i + 1}</span>
              <p className="mt-2 font-medium">{t(key)}</p>
            </li>
          ))}
        </ol>
      </section>

      {posts.length ? (
        <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
          <h2 className="text-3xl font-bold">{t("home.latestPosts")}</h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} readMore={t("blog.readMore")} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
