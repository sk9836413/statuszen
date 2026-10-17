"use server";

import { redirect } from "next/navigation";
import { guardDashboard } from "@/lib/dashboard";
import { getUserChannels } from "@/lib/channels";
import { runCheck } from "@/lib/checks";
import { countActiveMonitors } from "@/lib/dashboard-data";
import { getT } from "@/lib/i18n/server";
import {
  countUserMonitors,
  createMonitor,
  deleteMonitor,
  getMonitorChannelIds,
  getOwnedMonitor,
  setMonitorChannels,
  updateMonitor,
  type MonitorRecord,
} from "@/lib/monitors";
import { recordResult } from "@/lib/monitor-state";
import { atLimit } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { isMonitorType, monitorTarget, normalizeConfig } from "@/monitor/normalize";
import { INTERVAL_CHOICES, type CheckResult, type MonitorType } from "@/monitor/types";
import type { FormState } from "../types";
import { idOf, ids, isPrivateTarget, monitorConfigError, parseJsonField, str } from "./helpers";

export async function saveMonitorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const { user, entitlements } = guard;

  const editing = str(formData.get("monitor_id")) !== "";
  const existing = editing ? await getOwnedMonitor(idOf(formData.get("monitor_id")), user.id) : undefined;
  if (editing && !existing) return { error: t("dash.err.monitorNotFound") };

  const rawType = existing?.type ?? str(formData.get("type"));
  if (!isMonitorType(rawType)) return { error: t("dash.err.type") };
  const type: MonitorType = rawType;

  const name = str(formData.get("name")).trim();
  if (name.length > 120) return { error: t("dash.err.name") };

  const config = normalizeConfig(type, parseJsonField(formData.get("config")));
  const configError = monitorConfigError(type, config as unknown as Record<string, unknown>, t);
  if (configError) return { error: configError };
  const settings = await getSettings();
  if (!settings.allow_private_targets && isPrivateTarget(type, config as unknown as Record<string, unknown>)) return { error: t("dash.err.privateTarget") };

  const intervalSec = Number(str(formData.get("interval")));
  if (!(INTERVAL_CHOICES as readonly number[]).includes(intervalSec)) return { error: t("dash.err.interval") };
  if (intervalSec < entitlements.minIntervalSec) return { error: t("dash.err.intervalPlan") };

  const confirmCount = Number(str(formData.get("confirm")));
  if (!Number.isInteger(confirmCount) || confirmCount < 1 || confirmCount > 5) return { error: t("dash.err.confirm") };

  // Alert channels must belong to this user.
  const owned = new Set((await getUserChannels(user.id)).map((c) => c.id));
  const channelIds = ids(formData.getAll("channels"));
  if (channelIds.some((id) => !owned.has(id))) return { error: t("dash.err.channelNotFound") };

  const isActive = formData.get("paused") !== "on";

  if (!existing) {
    if (atLimit(await countUserMonitors(user.id), entitlements.maxMonitors)) return { error: t("dash.err.monitorLimit", { limit: entitlements.maxMonitors }) };
    const id = await createMonitor(user.id, { name: name || monitorTarget(type, config), type, config, intervalSec, confirmCount, isActive });
    await setMonitorChannels(id, channelIds);
    redirect(`/dashboard/monitors/${id}?created=1`);
  }

  if (isActive && !existing.isActive && atLimit(await countActiveMonitors(user.id), entitlements.maxMonitors)) {
    return { error: t("dash.err.activeLimit", { limit: entitlements.maxMonitors }) };
  }
  await updateMonitor(existing, {
    name: name || monitorTarget(type, config),
    config,
    ...(intervalSec !== existing.intervalSec ? { intervalSec } : {}),
    confirmCount,
    ...(isActive !== existing.isActive ? { isActive } : {}),
  });
  await setMonitorChannels(existing.id, channelIds);
  redirect(`/dashboard/monitors/${existing.id}?saved=1`);
}

export interface TestResult extends Partial<CheckResult> {
  error: string | null;
  ok: boolean;
  /** Set when the test could not run (validation, rate limit). */
  invalid?: boolean;
}

/** "Test now": run one check against the unsaved form values. Nothing is stored. */
export async function testMonitorAction(formData: FormData): Promise<TestResult> {
  const guard = await guardDashboard({ allowInDemo: true });
  if (!guard.ok) return { ok: false, invalid: true, error: guard.error };
  const t = await getT();
  const type = str(formData.get("type"));
  if (!isMonitorType(type)) return { ok: false, invalid: true, error: t("dash.err.type") };
  if (!rateLimit(`sz-test:${guard.user.id}`, 12, 60_000)) return { ok: false, invalid: true, error: t("dash.err.testRate") };

  const config = normalizeConfig(type, parseJsonField(formData.get("config")));
  const configError = monitorConfigError(type, config as unknown as Record<string, unknown>, t);
  if (configError) return { ok: false, invalid: true, error: configError };
  const settings = await getSettings();
  if (!settings.allow_private_targets && isPrivateTarget(type, config as unknown as Record<string, unknown>)) {
    return { ok: false, invalid: true, error: t("dash.err.privateTarget") };
  }

  const stamp = new Date().toISOString();
  const draft: MonitorRecord = {
    id: 0,
    userId: guard.user.id,
    name: "",
    type,
    config,
    target: monitorTarget(type, config),
    intervalSec: 60,
    confirmCount: 1,
    status: "pending",
    isActive: true,
    failStreak: 0,
    lastCheckAt: null,
    nextCheckAt: null,
    lastChangeAt: null,
    lastResponseMs: null,
    lastError: null,
    sslExpiresAt: null,
    domainExpiresAt: null,
    heartbeatToken: "",
    lastPingAt: null,
    runStartedAt: null,
    lastReminderAt: null,
    sortOrder: 0,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const result = await runCheck(draft, { allowPrivate: settings.allow_private_targets });
  return { ...result, error: result.error ?? null };
}

/** Pause or resume one monitor (fields: monitor_id, active = "1" | "0"). */
export async function toggleMonitorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const monitor = await getOwnedMonitor(idOf(formData.get("monitor_id")), guard.user.id);
  if (!monitor) return { error: t("dash.err.monitorNotFound") };
  const active = formData.get("active") === "1";
  if (active === monitor.isActive) return {};
  const { maxMonitors, minIntervalSec } = guard.entitlements;
  if (active && atLimit(await countActiveMonitors(guard.user.id), maxMonitors)) return { error: t("dash.err.activeLimit", { limit: maxMonitors }) };
  // A monitor resumed after a downgrade runs at the plan's interval.
  await updateMonitor(monitor, { isActive: active, ...(active && monitor.intervalSec < minIntervalSec ? { intervalSec: minIntervalSec } : {}) });
  return { success: active ? t("dash.monitor.resumed") : t("dash.monitor.paused") };
}

/** Pause or resume several monitors (fields: ids[], op = "pause" | "resume"). */
export async function bulkMonitorsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const op = str(formData.get("op"));
  if (op !== "pause" && op !== "resume") return { error: t("dash.err.generic") };
  const monitors = (await Promise.all(ids(formData.getAll("ids")).slice(0, 500).map((id) => getOwnedMonitor(id, guard.user.id)))).filter(
    (m): m is MonitorRecord => Boolean(m),
  );
  if (!monitors.length) return { error: t("dash.err.noneSelected") };

  const { maxMonitors, minIntervalSec } = guard.entitlements;
  let active = await countActiveMonitors(guard.user.id);
  let changed = 0;
  let skipped = 0;
  for (const m of monitors) {
    if (op === "pause" && m.isActive) {
      await updateMonitor(m, { isActive: false });
      changed += 1;
    } else if (op === "resume" && !m.isActive) {
      if (atLimit(active, maxMonitors)) {
        skipped += 1;
        continue;
      }
      await updateMonitor(m, { isActive: true, ...(m.intervalSec < minIntervalSec ? { intervalSec: minIntervalSec } : {}) });
      active += 1;
      changed += 1;
    }
  }
  if (skipped) return { error: t("dash.err.bulkLimit", { n: skipped, limit: maxMonitors }) };
  return { success: t("dash.monitors.bulkDone", { n: changed }) };
}

export async function deleteMonitorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const monitor = await getOwnedMonitor(idOf(formData.get("monitor_id")), guard.user.id);
  if (!monitor) return { error: t("dash.err.monitorNotFound") };
  await deleteMonitor(monitor.id);
  redirect("/dashboard/monitors?deleted=1");
}

export async function duplicateMonitorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const monitor = await getOwnedMonitor(idOf(formData.get("monitor_id")), guard.user.id);
  if (!monitor) return { error: t("dash.err.monitorNotFound") };
  const { maxMonitors, minIntervalSec } = guard.entitlements;
  if (atLimit(await countUserMonitors(guard.user.id), maxMonitors)) return { error: t("dash.err.monitorLimit", { limit: maxMonitors }) };
  const id = await createMonitor(guard.user.id, {
    name: t("dash.monitor.copyName", { name: monitor.name }).slice(0, 120),
    type: monitor.type,
    config: monitor.config,
    intervalSec: Math.max(monitor.intervalSec, minIntervalSec),
    confirmCount: monitor.confirmCount,
    // Start paused so the copy can be edited before it runs.
    isActive: false,
  });
  await setMonitorChannels(id, await getMonitorChannelIds(monitor.id));
  redirect(`/dashboard/monitors/${id}/edit?copied=1`);
}

/** "Check now" on a saved monitor: run one check and record it like the scheduler does. */
export async function checkNowAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const monitor = await getOwnedMonitor(idOf(formData.get("monitor_id")), guard.user.id);
  if (!monitor) return { error: t("dash.err.monitorNotFound") };
  if (!monitor.isActive || monitor.type === "heartbeat" || monitor.type === "domain") return { error: t("dash.err.generic") };
  if (!rateLimit(`sz-checknow:${guard.user.id}`, 6, 60_000)) return { error: t("dash.err.testRate") };
  const settings = await getSettings();
  const result = await runCheck(monitor, { allowPrivate: settings.allow_private_targets });
  const done = Date.now();
  const interval = Math.max(monitor.intervalSec, guard.entitlements.minIntervalSec);
  await recordResult(monitor, result, {
    at: new Date(done),
    nextCheckAt: new Date(done + interval * 1000).toISOString(),
    recheckAt: new Date(done + Math.min(30, interval) * 1000).toISOString(),
  });
  return result.ok ? { success: t("dash.monitor.checkPassed") } : { error: t("dash.monitor.checkFailed", { error: result.error ?? t("dash.err.generic") }) };
}
