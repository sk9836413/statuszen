"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { notifySubscribers } from "@/lib/alerts";
import { guardDashboard } from "@/lib/dashboard";
import { updateMaintenance } from "@/lib/dashboard-data";
import { getT } from "@/lib/i18n/server";
import { addIncidentUpdate, createIncident, deleteIncident, getOwnedIncident, RESOLVED_STATUSES } from "@/lib/incidents";
import type { Translator } from "@/lib/i18n/messages";
import { getUserMonitors } from "@/lib/monitors";
import { INCIDENT_STATUSES, MAINTENANCE_STATUSES, type Impact, type IncidentStatus } from "@/monitor/types";
import type { FormState } from "../types";
import { idOf, ids, str } from "./helpers";

const MANUAL_IMPACTS: Impact[] = ["none", "minor", "major", "critical"];
const MAX_WINDOW_MS = 31 * 86_400_000;

/** Monitor ids from the form, all owned by `userId` (null when one is not). */
async function ownedMonitorIds(formData: FormData, userId: number): Promise<number[] | null> {
  const wanted = ids(formData.getAll("monitors"));
  if (!wanted.length) return [];
  const owned = new Set((await getUserMonitors(userId)).map((m) => m.id));
  return wanted.every((id) => owned.has(id)) ? wanted : null;
}

function notifyLater(incidentId: number, status: IncidentStatus, message: string) {
  if (!message.trim()) return;
  // Email subscribers after the response has been sent.
  after(() => notifySubscribers(incidentId, { status, message }).then(() => undefined));
}

function titleError(title: string, t: Translator): string {
  return !title || title.length > 200 ? t("dash.err.incidentTitle") : "";
}

export async function createIncidentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const title = str(formData.get("title")).trim();
  if (titleError(title, t)) return { error: titleError(title, t) };
  const status = str(formData.get("status")) as IncidentStatus;
  if (!(INCIDENT_STATUSES as readonly string[]).includes(status)) return { error: t("dash.err.status") };
  const impact = str(formData.get("impact")) as Impact;
  if (!MANUAL_IMPACTS.includes(impact)) return { error: t("dash.err.impact") };
  const message = str(formData.get("message")).trim();
  if (!message) return { error: t("dash.err.message") };
  if (message.length > 5000) return { error: t("dash.err.messageLong") };
  const monitorIds = await ownedMonitorIds(formData, guard.user.id);
  if (!monitorIds) return { error: t("dash.err.monitorNotFound") };

  const id = await createIncident({ userId: guard.user.id, kind: "manual", title, status, impact, message, monitorIds });
  notifyLater(id, status, message);
  redirect(`/dashboard/incidents/${id}?created=1`);
}

/** Post a timeline update (fields: incident_id, status, message). Works for incidents and maintenance. */
export async function postIncidentUpdateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const incident = await getOwnedIncident(idOf(formData.get("incident_id")), guard.user.id);
  if (!incident) return { error: t("dash.err.incidentNotFound") };
  const allowed: readonly string[] = incident.kind === "maintenance" ? MAINTENANCE_STATUSES : INCIDENT_STATUSES;
  const status = str(formData.get("status")) as IncidentStatus;
  if (!allowed.includes(status)) return { error: t("dash.err.status") };
  const message = str(formData.get("message")).trim();
  if (!message) return { error: t("dash.err.message") };
  if (message.length > 5000) return { error: t("dash.err.messageLong") };
  if (RESOLVED_STATUSES.includes(incident.status)) return { error: t("dash.err.incidentClosed") };

  await addIncidentUpdate(incident.id, status, message);
  notifyLater(incident.id, status, message);
  return { success: RESOLVED_STATUSES.includes(status) ? t("dash.incident.resolvedNotice") : t("dash.incident.updatePosted") };
}

export async function deleteIncidentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const incident = await getOwnedIncident(idOf(formData.get("incident_id")), guard.user.id);
  if (!incident) return { error: t("dash.err.incidentNotFound") };
  await deleteIncident(incident.id);
  redirect(incident.kind === "maintenance" ? "/dashboard/maintenance?deleted=1" : "/dashboard/incidents?deleted=1");
}

/** Schedule or edit a maintenance window. Times arrive as UTC ISO strings (converted in the browser). */
export async function saveMaintenanceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const editing = str(formData.get("incident_id")) !== "";
  const existing = editing ? await getOwnedIncident(idOf(formData.get("incident_id")), guard.user.id) : undefined;
  if (editing && (!existing || existing.kind !== "maintenance")) return { error: t("dash.err.incidentNotFound") };

  const title = str(formData.get("title")).trim();
  if (titleError(title, t)) return { error: titleError(title, t) };
  const start = Date.parse(str(formData.get("start_utc")));
  const end = Date.parse(str(formData.get("end_utc")));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { error: t("dash.err.maintTimes") };
  if (end <= start) return { error: t("dash.err.maintOrder") };
  if (end - start > MAX_WINDOW_MS) return { error: t("dash.err.maintLong") };
  if (!existing && end < Date.now()) return { error: t("dash.err.maintPast") };
  const monitorIds = await ownedMonitorIds(formData, guard.user.id);
  if (!monitorIds) return { error: t("dash.err.monitorNotFound") };
  if (!monitorIds.length) return { error: t("dash.err.maintMonitors") };
  const message = str(formData.get("message")).trim();
  if (message.length > 5000) return { error: t("dash.err.messageLong") };

  const scheduledStart = new Date(start).toISOString();
  const scheduledEnd = new Date(end).toISOString();
  if (existing) {
    await updateMaintenance(existing.id, { title, scheduledStart, scheduledEnd, monitorIds });
    if (message) {
      await addIncidentUpdate(existing.id, existing.status, message);
      notifyLater(existing.id, existing.status, message);
    }
    redirect("/dashboard/maintenance?saved=1");
  }
  const status: IncidentStatus = start <= Date.now() ? "in_progress" : "scheduled";
  const body = message || t("dash.maint.defaultMessage");
  const id = await createIncident({ userId: guard.user.id, kind: "maintenance", title, status, impact: "maintenance", message: body, monitorIds, scheduledStart, scheduledEnd });
  notifyLater(id, status, body);
  redirect("/dashboard/maintenance?created=1");
}

/** End a maintenance window early or cancel it (fields: incident_id, op = "complete" | "cancel"). */
export async function finishMaintenanceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const incident = await getOwnedIncident(idOf(formData.get("incident_id")), guard.user.id);
  if (!incident || incident.kind !== "maintenance") return { error: t("dash.err.incidentNotFound") };
  if (incident.status === "completed") return {};
  const message = formData.get("op") === "cancel" ? t("dash.maint.cancelledMessage") : t("dash.maint.completedMessage");
  await addIncidentUpdate(incident.id, "completed", message);
  notifyLater(incident.id, "completed", message);
  return { success: message };
}
