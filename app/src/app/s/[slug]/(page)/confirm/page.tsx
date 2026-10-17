import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheck, CircleX } from "lucide-react";
import { NoticeCard } from "@/components/status/notice";
import { getDb, now } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { getViewablePage, pendingExpired } from "@/lib/status-view";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ token?: string }> };

export default async function ConfirmSubscriptionPage({ params, searchParams }: Props) {
  const [{ slug }, { token }] = await Promise.all([params, searchParams]);
  const found = await getViewablePage(slug);
  if (!found) notFound();
  const { page } = found;
  const t = await getT();
  const back = { backHref: `/s/${page.slug}`, backLabel: t("status.backToStatus") };

  const db = await getDb();
  const subscriber =
    typeof token === "string" && /^[A-Za-z0-9]{16,64}$/.test(token)
      ? await db.selectFrom("subscribers").selectAll().where("page_id", "=", page.id).where("token", "=", token).executeTakeFirst()
      : undefined;
  const expired = subscriber && !subscriber.confirmed_at && pendingExpired(subscriber.created_at);

  if (!subscriber || expired) {
    return (
      <NoticeCard icon={CircleX} tone="error" title={t("status.subscribeTitle")} {...back}>
        {t("status.confirmInvalid")}
      </NoticeCard>
    );
  }
  if (!subscriber.confirmed_at) {
    await db.updateTable("subscribers").set({ confirmed_at: now() }).where("id", "=", subscriber.id).execute();
  }
  return (
    <NoticeCard icon={CircleCheck} tone="success" title={t("status.confirmedTitle")} {...back}>
      {t("status.confirmedText", { email: subscriber.email, name: page.name })}
    </NoticeCard>
  );
}
