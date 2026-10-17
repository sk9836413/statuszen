import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BellOff, CircleCheck, CircleX } from "lucide-react";
import { unsubscribeFromStatusPage } from "@/app/actions/status-page";
import { NoticeCard } from "@/components/status/notice";
import { StatusTheme } from "@/components/status/theme";
import { getSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { getStatusPageBySlug } from "@/lib/status-pages";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ token?: string; done?: string }> };

/** Hide most of the address: "jo***@example.com". */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(1, Math.min(6, user.length - 2)))}@${domain}`;
}

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const [{ slug }, { token, done }] = await Promise.all([params, searchParams]);
  // The layout only renders public pages (or the owner's preview); unsubscribing must
  // still work for anyone with a valid link, so the page itself is looked up directly.
  const page = await getStatusPageBySlug(slug);
  if (!page) notFound();
  const [t, settings] = await Promise.all([getT(), getSettings()]);
  const theme = <StatusTheme theme={page.settings.theme} accent={page.settings.accent || settings.primary_color} />;
  const back = { backHref: `/s/${page.slug}`, backLabel: t("status.backToStatus") };

  if (done) {
    return (
      <>
      {theme}
      <NoticeCard icon={CircleCheck} tone="success" title={t("status.unsubDone")} {...back}>
        {t("status.unsubDoneText", { name: page.name })}
      </NoticeCard>
      </>
    );
  }

  const db = await getDb();
  const subscriber =
    typeof token === "string" && /^[A-Za-z0-9]{16,64}$/.test(token)
      ? await db.selectFrom("subscribers").select(["email"]).where("page_id", "=", page.id).where("token", "=", token).executeTakeFirst()
      : undefined;

  if (!subscriber) {
    return (
      <>
      {theme}
      <NoticeCard icon={CircleX} tone="error" title={t("status.unsubTitle", { name: page.name })} {...back}>
        {t("status.unsubInvalid")}
      </NoticeCard>
      </>
    );
  }

  return (
    <>
    {theme}
    <NoticeCard icon={BellOff} tone="neutral" title={t("status.unsubTitle", { name: page.name })} {...back}>
      <p>{t("status.unsubText", { email: maskEmail(subscriber.email), name: page.name })}</p>
      <form action={unsubscribeFromStatusPage} className="mt-6">
        <input type="hidden" name="slug" value={page.slug} />
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
        >
          {t("status.unsubButton")}
        </button>
      </form>
    </NoticeCard>
    </>
  );
}
