"use server";

import { revalidatePath } from "next/cache";
import { guardAdmin } from "@/lib/admin";
import { regenerateCronSecret, runTick } from "@/lib/scheduler";
import type { FormState } from "@/app/actions/types";

export async function runChecksNow(): Promise<FormState> {
  const guard = await guardAdmin({ allowInDemo: true });
  if (!guard.ok) return { error: guard.error };
  const s = await runTick({ budgetMs: 25_000, source: "manual" });
  revalidatePath("/admin/system");
  if (s.skippedLocked) return { error: "Another check run is in progress. Try again in a minute." };
  return {
    success: `Checked ${s.checked} monitor${s.checked === 1 ? "" : "s"} in ${(s.durationMs / 1000).toFixed(1)} s: ${s.down} went down, ${s.recovered} recovered, ${s.alertsSent} alert${s.alertsSent === 1 ? "" : "s"} sent${s.deferred ? `, ${s.deferred} left for the next run` : ""}.`,
  };
}

export async function regenerateCronKey(): Promise<FormState> {
  const guard = await guardAdmin();
  if (!guard.ok) return { error: guard.error };
  if (process.env.CRON_SECRET?.trim()) return { error: "The secret comes from the CRON_SECRET environment variable. Change it there." };
  await regenerateCronSecret();
  revalidatePath("/admin/system");
  return { success: "New secret created. Update your cron job and worker with the new URL." };
}
