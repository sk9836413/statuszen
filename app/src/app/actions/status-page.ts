"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, now } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { mailConfigured, sendMail } from "@/lib/mail";
import { randomToken } from "@/lib/monitors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { baseUrl } from "@/lib/request";
import { getSettings } from "@/lib/settings";
import { getStatusPageBySlug } from "@/lib/status-pages";
import { getPublicStatusPage, PENDING_SUBSCRIBER_TTL_MS } from "@/lib/status-view";
import type { FormState } from "./types";

/** Double opt-in: store a pending subscriber and email a confirmation link. */
export async function subscribeToStatusPage(_prev: FormState, formData: FormData): Promise<FormState> {
  const [settings, t] = await Promise.all([getSettings(), getT()]);
  const page = await getPublicStatusPage(String(formData.get("slug") ?? ""));
  if (!page || !page.settings.allowSubscribe) return { error: t("status.err.closed") };

  // Honeypot: bots fill every field. Answer exactly like a real success.
  if (formData.get("website")) return { success: t("status.subscribeSent") };

  if (!mailConfigured(settings)) return { error: t("status.err.mailOff") };

  const ip = await clientIp();
  if (!rateLimit(`subscribe:${ip}`, 5, 30 * 60_000)) return { error: t("status.err.tooMany") };

  const parsed = z.email().max(190).safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: t("status.err.email") };
  const email = parsed.data;

  // One confirmation email per address and page every few minutes.
  if (!rateLimit(`subscribe:${page.id}:${email}`, 1, 5 * 60_000)) return { success: t("status.subscribeSent") };

  const db = await getDb();
  // Forget sign-ups that were never confirmed.
  await db
    .deleteFrom("subscribers")
    .where("page_id", "=", page.id)
    .where("confirmed_at", "is", null)
    .where("created_at", "<", new Date(Date.now() - PENDING_SUBSCRIBER_TTL_MS).toISOString())
    .execute();

  const existing = await db.selectFrom("subscribers").selectAll().where("page_id", "=", page.id).where("email", "=", email).executeTakeFirst();
  // Already subscribed: don't reveal it, don't email again.
  if (existing?.confirmed_at) return { success: t("status.subscribeSent") };

  const token = randomToken(32);
  if (existing) {
    await db.updateTable("subscribers").set({ token, created_at: now() }).where("id", "=", existing.id).execute();
  } else {
    await db.insertInto("subscribers").values({ page_id: page.id, email, token, confirmed_at: null, created_at: now() }).execute();
  }

  const url = `${await baseUrl()}/s/${page.slug}/confirm?token=${token}`;
  try {
    await sendMail({
      to: email,
      subject: t("status.confirmMailSubject", { name: page.name }),
      text: t("status.confirmMailText", { name: page.name, url }),
    });
  } catch {
    if (!existing) await db.deleteFrom("subscribers").where("page_id", "=", page.id).where("token", "=", token).execute();
    return { error: t("status.err.send") };
  }
  return { success: t("status.subscribeSent") };
}

/** Unsubscribe button on /s/[slug]/unsubscribe (a POST, so link scanners can't unsubscribe people). */
export async function unsubscribeFromStatusPage(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const token = String(formData.get("token") ?? "");
  // Works even after the page was made private.
  const page = await getStatusPageBySlug(slug);
  if (page && /^[A-Za-z0-9]{16,64}$/.test(token)) {
    const db = await getDb();
    await db.deleteFrom("subscribers").where("page_id", "=", page.id).where("token", "=", token).execute();
  }
  redirect(`/s/${encodeURIComponent(page?.slug ?? slug)}/unsubscribe?done=1`);
}
