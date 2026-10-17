"use server";

import { redirect } from "next/navigation";
import { saveUpload } from "@/lib/admin";
import { guardDashboard } from "@/lib/dashboard";
import { deleteSubscriber } from "@/lib/dashboard-data";
import { getT } from "@/lib/i18n/server";
import { plural, type Translator } from "@/lib/i18n/messages";
import { getUserMonitors } from "@/lib/monitors";
import { atLimit } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import {
  countUserStatusPages,
  createStatusPage,
  deleteStatusPage,
  getOwnedStatusPage,
  isSlugTaken,
  setPageComponents,
  slugProblem,
  updateStatusPage,
  type PageComponent,
} from "@/lib/status-pages";
import { httpUrl, normalizeSlug, normalizeStatusPageSettings } from "@/monitor/normalize";
import type { FormState } from "../types";
import { idOf, parseJsonField, str } from "./helpers";

const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);

function slugError(slug: string, t: Translator): string {
  const problem = slugProblem(slug);
  if (!problem) return "";
  return slug.length < 3 ? t("dash.err.slugShort") : t("dash.err.slugReserved");
}

export interface SlugCheck {
  slug: string;
  available: boolean;
  message: string;
}

/** Live availability check for the slug field. */
export async function checkSlugAction(raw: string, pageId?: number): Promise<SlugCheck> {
  const guard = await guardDashboard({ allowInDemo: true });
  const t = await getT();
  const slug = normalizeSlug(raw);
  if (!guard.ok) return { slug, available: false, message: guard.error };
  if (!rateLimit(`sz-slug:${guard.user.id}`, 120, 60_000)) return { slug, available: false, message: t("dash.err.testRate") };
  const problem = slugError(slug, t);
  if (problem) return { slug, available: false, message: problem };
  const exceptId = pageId && (await getOwnedStatusPage(pageId, guard.user.id)) ? pageId : undefined;
  if (await isSlugTaken(slug, exceptId)) return { slug, available: false, message: t("dash.err.slugTaken") };
  return { slug, available: true, message: t("dash.pages.slugFree") };
}

export async function createStatusPageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const name = str(formData.get("name")).trim();
  if (!name || name.length > 120) return { error: t("dash.err.pageName") };
  const slug = normalizeSlug(str(formData.get("slug")) || name);
  const problem = slugError(slug, t);
  if (problem) return { error: problem };
  if (atLimit(await countUserStatusPages(guard.user.id), guard.entitlements.maxStatusPages)) {
    return { error: plural(t, "dash.err.pageLimit", guard.entitlements.maxStatusPages, { limit: guard.entitlements.maxStatusPages }) };
  }
  if (await isSlugTaken(slug)) return { error: t("dash.err.slugTaken") };

  const id = await createStatusPage(guard.user.id, { name, slug });
  // Start with every monitor on the page; the owner can remove them in the builder.
  const monitors = await getUserMonitors(guard.user.id);
  await setPageComponents(
    id,
    monitors.slice(0, 50).map((m, i) => ({ monitorId: m.id, displayName: "", groupName: "", sortOrder: i })),
  );
  redirect(`/dashboard/status-pages/${id}?created=1`);
}

export async function saveStatusPageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const page = await getOwnedStatusPage(idOf(formData.get("page_id")), guard.user.id);
  if (!page) return { error: t("dash.err.pageNotFound") };

  const name = str(formData.get("name")).trim();
  if (!name || name.length > 120) return { error: t("dash.err.pageName") };
  const slug = normalizeSlug(str(formData.get("slug")));
  if (slug !== page.slug) {
    const problem = slugError(slug, t);
    if (problem) return { error: problem };
    if (await isSlugTaken(slug, page.id)) return { error: t("dash.err.slugTaken") };
  }
  const description = str(formData.get("description")).trim();
  if (description.length > 500) return { error: t("dash.err.description") };

  // Logo: a new upload wins, then an explicit removal, then a URL.
  let logo: string | null | undefined;
  const file = formData.get("logo_file");
  if (file instanceof File && file.size > 0) {
    if (!LOGO_TYPES.has(file.type)) return { error: t("dash.err.logoType") };
    if (file.size > 1024 * 1024) return { error: t("dash.err.logoSize") };
    try {
      logo = await saveUpload(file, "status-logo");
    } catch {
      return { error: t("dash.err.logoType") };
    }
  } else if (formData.get("logo_remove") === "on") {
    logo = null;
  } else {
    // The field holds the current logo (an uploaded file name or a URL) unless edited.
    const url = str(formData.get("logo_url")).trim();
    if (!url) logo = null;
    else if (url !== page.logo) {
      logo = httpUrl(url);
      if (!logo) return { error: t("dash.err.logoUrl") };
    }
  }

  const announcement = str(formData.get("announcement")).trim();
  if (announcement.length > 300) return { error: t("dash.err.announcement") };
  const websiteUrl = str(formData.get("website_url")).trim();
  if (websiteUrl && !httpUrl(websiteUrl)) return { error: t("dash.err.websiteUrl") };
  const accent = str(formData.get("accent")).trim();
  if (accent && !/^#[0-9a-f]{6}$/i.test(accent)) return { error: t("dash.err.accent") };

  const settings = normalizeStatusPageSettings({
    theme: str(formData.get("theme")),
    accent: formData.get("accent_custom") === "on" ? accent : "",
    historyDays: str(formData.get("history_days")),
    showUptimePercent: formData.get("show_uptime") === "on",
    showResponseTimes: formData.get("show_response") === "on",
    allowSubscribe: formData.get("allow_subscribe") === "on",
    announcement,
    websiteUrl,
    noindex: formData.get("noindex") === "on",
  });

  // Components: every monitor must belong to this user.
  const owned = new Set((await getUserMonitors(guard.user.id)).map((m) => m.id));
  const raw = parseJsonField(formData.get("components"));
  const list = Array.isArray(raw) ? raw : [];
  const components: PageComponent[] = [];
  for (const [i, item] of list.slice(0, 200).entries()) {
    const c = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const monitorId = Number(c.monitorId);
    if (!owned.has(monitorId)) return { error: t("dash.err.monitorNotFound") };
    components.push({
      monitorId,
      displayName: typeof c.displayName === "string" ? c.displayName.slice(0, 120) : "",
      groupName: typeof c.groupName === "string" ? c.groupName.slice(0, 80) : "",
      sortOrder: i,
    });
  }

  await updateStatusPage(page.id, { name, slug, description, settings, isPublic: formData.get("is_public") === "on", ...(logo !== undefined ? { logo } : {}) });
  await setPageComponents(page.id, components);
  return { success: t("dash.pages.saved") };
}

export async function deleteStatusPageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const page = await getOwnedStatusPage(idOf(formData.get("page_id")), guard.user.id);
  if (!page) return { error: t("dash.err.pageNotFound") };
  await deleteStatusPage(page.id);
  redirect("/dashboard/status-pages?deleted=1");
}

export async function removeSubscriberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const page = await getOwnedStatusPage(idOf(formData.get("page_id")), guard.user.id);
  if (!page) return { error: t("dash.err.pageNotFound") };
  await deleteSubscriber(page.id, idOf(formData.get("subscriber_id")));
  return { success: t("dash.subs.removed") };
}
