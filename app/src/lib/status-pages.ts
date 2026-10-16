import "server-only";
import { getDb, now } from "./db";
import type { StatusPage } from "./db/schema";
import { normalizeSlug, normalizeStatusPageSettings, parseJson } from "@/monitor/normalize";
import type { MonitorStatus, OverallStatus, StatusPageSettings } from "@/monitor/types";

export interface StatusPageRecord {
  id: number;
  userId: number;
  slug: string;
  name: string;
  description: string;
  logo: string;
  settings: StatusPageSettings;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toStatusPageRecord(row: StatusPage): StatusPageRecord {
  return {
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    logo: row.logo ?? "",
    settings: normalizeStatusPageSettings(parseJson(row.settings)),
    isPublic: row.is_public === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Slugs that would clash with app routes or look official. */
const RESERVED_SLUGS = new Set(["admin", "api", "dashboard", "status", "login", "register", "pricing", "blog", "www", "app", "help", "support", "new"]);

export function slugProblem(slug: string): string {
  if (slug.length < 3) return "Use at least 3 letters or numbers for the address.";
  if (RESERVED_SLUGS.has(slug)) return "This address is reserved. Choose another one.";
  return "";
}

export async function getUserStatusPages(userId: number): Promise<StatusPageRecord[]> {
  const db = await getDb();
  return (await db.selectFrom("status_pages").selectAll().where("user_id", "=", userId).orderBy("id").execute()).map(toStatusPageRecord);
}

export async function countUserStatusPages(userId: number): Promise<number> {
  const db = await getDb();
  const row = await db.selectFrom("status_pages").select((eb) => eb.fn.countAll<number>().as("n")).where("user_id", "=", userId).executeTakeFirst();
  return Number(row?.n ?? 0);
}

export async function getOwnedStatusPage(pageId: number, userId: number): Promise<StatusPageRecord | undefined> {
  if (!Number.isInteger(pageId) || pageId < 1) return undefined;
  const db = await getDb();
  const row = await db.selectFrom("status_pages").selectAll().where("id", "=", pageId).where("user_id", "=", userId).executeTakeFirst();
  return row ? toStatusPageRecord(row) : undefined;
}

export async function getStatusPageBySlug(slug: string): Promise<StatusPageRecord | undefined> {
  const clean = normalizeSlug(slug);
  if (!clean) return undefined;
  const db = await getDb();
  const row = await db.selectFrom("status_pages").selectAll().where("slug", "=", clean).executeTakeFirst();
  return row ? toStatusPageRecord(row) : undefined;
}

export async function isSlugTaken(slug: string, exceptPageId?: number): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .selectFrom("status_pages")
    .select("id")
    .where("slug", "=", slug)
    .$if(exceptPageId !== undefined, (qb) => qb.where("id", "!=", exceptPageId!))
    .executeTakeFirst();
  return Boolean(row);
}

export async function createStatusPage(userId: number, input: { name: string; slug: string; description?: string; settings?: unknown }): Promise<number> {
  const db = await getDb();
  const ts = now();
  const result = await db
    .insertInto("status_pages")
    .values({
      user_id: userId,
      slug: normalizeSlug(input.slug),
      name: input.name.trim().slice(0, 120),
      description: input.description?.trim().slice(0, 500) || null,
      logo: null,
      settings: JSON.stringify(normalizeStatusPageSettings(input.settings ?? {})),
      is_public: 1,
      created_at: ts,
      updated_at: ts,
    })
    .executeTakeFirstOrThrow();
  return Number(result.insertId);
}

export async function updateStatusPage(
  pageId: number,
  input: { name?: string; slug?: string; description?: string; logo?: string | null; settings?: unknown; isPublic?: boolean },
): Promise<void> {
  const db = await getDb();
  await db
    .updateTable("status_pages")
    .set({
      ...(input.name !== undefined ? { name: input.name.trim().slice(0, 120) } : {}),
      ...(input.slug !== undefined ? { slug: normalizeSlug(input.slug) } : {}),
      ...(input.description !== undefined ? { description: input.description.trim().slice(0, 500) || null } : {}),
      ...(input.logo !== undefined ? { logo: input.logo } : {}),
      ...(input.settings !== undefined ? { settings: JSON.stringify(normalizeStatusPageSettings(input.settings)) } : {}),
      ...(input.isPublic !== undefined ? { is_public: input.isPublic ? 1 : 0 } : {}),
      updated_at: now(),
    })
    .where("id", "=", pageId)
    .execute();
}

export async function deleteStatusPage(pageId: number): Promise<void> {
  const db = await getDb();
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("status_page_monitors").where("page_id", "=", pageId).execute();
    await trx.deleteFrom("subscribers").where("page_id", "=", pageId).execute();
    await trx.deleteFrom("status_pages").where("id", "=", pageId).execute();
  });
}

export interface PageComponent {
  monitorId: number;
  groupName: string;
  displayName: string;
  sortOrder: number;
}

export async function getPageComponents(pageId: number): Promise<PageComponent[]> {
  const db = await getDb();
  const rows = await db.selectFrom("status_page_monitors").selectAll().where("page_id", "=", pageId).orderBy("sort_order").execute();
  return rows.map((r) => ({ monitorId: r.monitor_id, groupName: r.group_name, displayName: r.display_name, sortOrder: r.sort_order }));
}

/** Replace a page's components; monitor ids must already be checked for ownership. */
export async function setPageComponents(pageId: number, components: PageComponent[]): Promise<void> {
  const db = await getDb();
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("status_page_monitors").where("page_id", "=", pageId).execute();
    const seen = new Set<number>();
    const rows = components
      .filter((c) => !seen.has(c.monitorId) && seen.add(c.monitorId))
      .slice(0, 200)
      .map((c, i) => ({ page_id: pageId, monitor_id: c.monitorId, group_name: c.groupName.trim().slice(0, 80), display_name: c.displayName.trim().slice(0, 120), sort_order: i }));
    if (rows.length) await trx.insertInto("status_page_monitors").values(rows).execute();
  });
}

/** Overall banner state from component statuses and open incidents. */
export function overallStatus(statuses: MonitorStatus[], openIncidentImpacts: string[]): OverallStatus {
  if (openIncidentImpacts.includes("critical")) return "major_outage";
  const down = statuses.filter((s) => s === "down").length;
  if (down && down === statuses.length) return "major_outage";
  if (down) return "partial_outage";
  if (openIncidentImpacts.some((i) => i === "major")) return "partial_outage";
  if (statuses.includes("maintenance") || openIncidentImpacts.includes("maintenance")) return "maintenance";
  if (openIncidentImpacts.some((i) => i === "minor")) return "degraded";
  return "operational";
}
