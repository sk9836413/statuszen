import "server-only";
import { getDb, now } from "./db";
import type { Plan } from "./db/schema";
import type { SessionUser } from "./auth/session";

export interface Entitlements {
  plan: Plan | null;
  /** True when the user has an active paid plan. */
  isPremium: boolean;
  /** Limits; 0 means unlimited. */
  maxMonitors: number;
  maxStatusPages: number;
  /** Shortest allowed check interval in seconds. */
  minIntervalSec: number;
  removeBranding: boolean;
  expiresAt: string | null;
}

/** Limits used if the free plan row was deleted. */
const FALLBACK_FREE = { maxMonitors: 5, maxStatusPages: 1, minIntervalSec: 300 };

export async function getActivePlans(): Promise<Plan[]> {
  const db = await getDb();
  return db.selectFrom("plans").selectAll().where("is_active", "=", 1).orderBy("sort_order").orderBy("id").execute();
}

export async function getAllPlans(): Promise<Plan[]> {
  const db = await getDb();
  return db.selectFrom("plans").selectAll().orderBy("sort_order").orderBy("id").execute();
}

export async function getPlan(id: number): Promise<Plan | undefined> {
  const db = await getDb();
  return db.selectFrom("plans").selectAll().where("id", "=", id).executeTakeFirst();
}

export async function getFreePlan(): Promise<Plan | undefined> {
  const db = await getDb();
  return db.selectFrom("plans").selectAll().where("is_free", "=", 1).orderBy("id").executeTakeFirst();
}

export function hasActivePaidPlan(user: Pick<SessionUser, "plan_id" | "plan_expires_at"> | null): boolean {
  return Boolean(user?.plan_id && user.plan_expires_at && user.plan_expires_at > now());
}

function fromPlan(plan: Plan): Pick<Entitlements, "maxMonitors" | "maxStatusPages" | "minIntervalSec" | "removeBranding"> {
  return {
    maxMonitors: plan.max_monitors,
    maxStatusPages: plan.max_status_pages,
    minIntervalSec: Math.max(10, plan.min_interval_sec),
    removeBranding: plan.remove_branding === 1,
  };
}

export async function getEntitlements(user: Pick<SessionUser, "role" | "plan_id" | "plan_expires_at"> | null): Promise<Entitlements> {
  if (user && hasActivePaidPlan(user)) {
    const plan = await getPlan(user.plan_id!);
    if (plan && !plan.is_free) return { plan, isPremium: true, ...fromPlan(plan), expiresAt: user.plan_expires_at };
  }
  // Administrators run the platform, so their own monitors are never limited.
  if (user?.role === "admin") {
    return { plan: null, isPremium: true, maxMonitors: 0, maxStatusPages: 0, minIntervalSec: 30, removeBranding: true, expiresAt: null };
  }
  const free = await getFreePlan();
  return {
    plan: free ?? null,
    isPremium: false,
    ...(free ? fromPlan(free) : { ...FALLBACK_FREE, removeBranding: false }),
    expiresAt: null,
  };
}

/** True when `used` has reached a limit (0 = unlimited). */
export function atLimit(used: number, limit: number): boolean {
  return limit > 0 && used >= limit;
}

export function planFeatures(plan: Pick<Plan, "features">): string[] {
  return (plan.features ?? "")
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}
