"use client";

import { useActionState, useId, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { createIncidentAction, postIncidentUpdateAction, saveMaintenanceAction } from "@/app/actions/dashboard/incidents";
import { initialFormState, type FormState } from "@/app/actions/types";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { INCIDENT_STATUSES, MAINTENANCE_STATUSES, type IncidentStatus, type MonitorStatus, type MonitorType } from "@/monitor/types";
import { StatusDot, TYPE_ICONS } from "./monitor-meta";

export interface PickerMonitor {
  id: number;
  name: string;
  type: MonitorType;
  status: MonitorStatus;
}

/** Checkbox list of the user's monitors (affected components). */
export function MonitorPicker({ monitors, selected, name = "monitors", legend, hint }: { monitors: PickerMonitor[]; selected: number[]; name?: string; legend: string; hint?: string }) {
  const t = useT();
  const [checked, setChecked] = useState(() => new Set(selected));
  const all = monitors.length > 0 && checked.size === monitors.length;
  return (
    <fieldset>
      <legend className="mb-1.5 flex w-full items-center justify-between gap-3 text-sm font-medium">
        <span>{legend}</span>
        {monitors.length > 1 ? (
          <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setChecked(all ? new Set() : new Set(monitors.map((m) => m.id)))}>
            {all ? t("dash.picker.none") : t("dash.picker.all")}
          </button>
        ) : null}
      </legend>
      {hint ? <p className="mb-2 text-xs text-muted">{hint}</p> : null}
      {monitors.length ? (
        <ul className="grid max-h-72 gap-1.5 overflow-y-auto rounded-lg border border-line p-1.5 sm:grid-cols-2">
          {monitors.map((m) => {
            const Icon = TYPE_ICONS[m.type];
            return (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-paper has-checked:bg-primary-soft">
                  <input
                    type="checkbox"
                    name={name}
                    value={m.id}
                    checked={checked.has(m.id)}
                    onChange={() =>
                      setChecked((s) => {
                        const next = new Set(s);
                        if (next.has(m.id)) next.delete(m.id);
                        else next.add(m.id);
                        return next;
                      })
                    }
                    className="size-4 shrink-0 accent-[var(--primary)]"
                  />
                  <StatusDot status={m.status} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">
          {t("dash.picker.empty")}{" "}
          <Link href="/dashboard/monitors/new" className="font-medium text-primary hover:underline">
            {t("dash.monitors.add")}
          </Link>
        </p>
      )}
    </fieldset>
  );
}

export function NewIncidentForm({ monitors, preselected }: { monitors: PickerMonitor[]; preselected: number[] }) {
  const t = useT();
  const uid = useId();
  const [state, action] = useActionState(createIncidentAction, initialFormState);
  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      <Field label={t("dash.incident.title")} htmlFor={`${uid}-title`} hint={t("dash.incident.titleHint")}>
        <Input id={`${uid}-title`} name="title" required maxLength={200} placeholder={t("dash.incident.titlePlaceholder")} autoComplete="off" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("dash.incident.status")} htmlFor={`${uid}-status`}>
          <Select id={`${uid}-status`} name="status" defaultValue="investigating">
            {INCIDENT_STATUSES.filter((s) => s !== "resolved").map((s) => (
              <option key={s} value={s}>
                {t(`dash.istatus.${s}` as MessageKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("dash.incident.impact")} htmlFor={`${uid}-impact`} hint={t("dash.incident.impactHint")}>
          <Select id={`${uid}-impact`} name="impact" defaultValue="minor">
            {(["none", "minor", "major", "critical"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`dash.impact.${s}` as MessageKey)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <MonitorPicker monitors={monitors} selected={preselected} legend={t("dash.incident.affected")} hint={t("dash.incident.affectedHint")} />
      <Field label={t("dash.incident.message")} htmlFor={`${uid}-message`} hint={t("dash.incident.messageHint")}>
        <Textarea id={`${uid}-message`} name="message" required maxLength={5000} placeholder={t("dash.incident.messagePlaceholder")} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText={t("dash.form.saving")}>{t("dash.incident.publish")}</SubmitButton>
        <Link href="/dashboard/incidents" className="text-sm font-medium text-muted hover:text-ink">
          {t("dash.form.cancel")}
        </Link>
      </div>
    </form>
  );
}

/** Post a timeline update; the status select starts at the incident's next likely step. */
export function IncidentUpdateForm({ incidentId, kind, current }: { incidentId: number; kind: "auto" | "manual" | "maintenance"; current: IncidentStatus }) {
  const t = useT();
  const uid = useId();
  const router = useRouter();
  const statuses: readonly IncidentStatus[] = kind === "maintenance" ? MAINTENANCE_STATUSES : INCIDENT_STATUSES;
  const [formKey, setFormKey] = useState(0);
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await postIncidentUpdateAction(prev, formData);
    if (result.success) {
      setFormKey((k) => k + 1);
      router.refresh();
    }
    return result;
  }, initialFormState);
  const next = statuses[Math.min(statuses.length - 1, Math.max(0, statuses.indexOf(current) + 1))] ?? current;
  return (
    <form key={formKey} action={action} className="space-y-4">
      <input type="hidden" name="incident_id" value={incidentId} />
      <FormMessage state={state} />
      <div>
        <Label>{t("dash.incident.status")}</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("dash.incident.status")}>
          {statuses.map((s) => (
            <label
              key={s}
              className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary"
            >
              <input type="radio" name="status" value={s} defaultChecked={s === next} className="sr-only" />
              {t(`dash.istatus.${s}` as MessageKey)}
            </label>
          ))}
        </div>
      </div>
      <Field label={t("dash.incident.message")} htmlFor={`${uid}-msg`}>
        <Textarea id={`${uid}-msg`} name="message" required maxLength={5000} placeholder={t("dash.incident.updatePlaceholder")} />
      </Field>
      <SubmitButton pendingText={t("dash.form.saving")}>{t("dash.incident.postUpdate")}</SubmitButton>
    </form>
  );
}

const noop = () => () => {};

/** "2026-10-17T14:00" in the browser's time zone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToIso(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function defaultWindow(): { start: string; end: string } {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return { start: start.toISOString(), end: new Date(start.getTime() + 3_600_000).toISOString() };
}

export interface MaintenanceValues {
  id?: number;
  title: string;
  start: string | null;
  end: string | null;
  monitorIds: number[];
}

/** Schedule or edit a maintenance window. Times are entered in the browser's time zone and sent as UTC. */
export function MaintenanceForm({ values, monitors }: { values: MaintenanceValues; monitors: PickerMonitor[] }) {
  const t = useT();
  const uid = useId();
  // Local times depend on the browser's time zone, so they are filled in after hydration.
  const zone = useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => "");
  const [fallback] = useState(defaultWindow);
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    formData.set("start_utc", localToIso(formData.get("start_local")));
    formData.set("end_utc", localToIso(formData.get("end_local")));
    return saveMaintenanceAction(prev, formData);
  }, initialFormState);
  const start = values.start ?? fallback.start;
  const end = values.end ?? fallback.end;

  return (
    <form action={action} className="space-y-5">
      {values.id ? <input type="hidden" name="incident_id" value={values.id} /> : null}
      <FormMessage state={state} />
      <Field label={t("dash.maint.titleField")} htmlFor={`${uid}-title`}>
        <Input id={`${uid}-title`} name="title" required maxLength={200} defaultValue={values.title} placeholder={t("dash.maint.titlePlaceholder")} autoComplete="off" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("dash.maint.start")} htmlFor={`${uid}-start`}>
          <Input key={zone ? "client" : "server"} id={`${uid}-start`} name="start_local" type="datetime-local" required defaultValue={zone ? toLocalInput(start) : ""} />
        </Field>
        <Field label={t("dash.maint.end")} htmlFor={`${uid}-end`}>
          <Input key={zone ? "client" : "server"} id={`${uid}-end`} name="end_local" type="datetime-local" required defaultValue={zone ? toLocalInput(end) : ""} />
        </Field>
      </div>
      <p className={cn("-mt-2 flex items-center gap-1.5 text-xs text-muted", !zone && "invisible")}>
        <Globe className="size-3.5" aria-hidden />
        {t("dash.maint.zone", { zone: zone || "UTC" })}
      </p>
      <MonitorPicker monitors={monitors} selected={values.monitorIds} legend={t("dash.maint.affected")} hint={t("dash.maint.affectedHint")} />
      <Field label={values.id ? t("dash.maint.updateMessage") : t("dash.incident.message")} htmlFor={`${uid}-message`} hint={values.id ? t("dash.maint.updateMessageHint") : t("dash.maint.messageHint")}>
        <Textarea id={`${uid}-message`} name="message" maxLength={5000} placeholder={t("dash.maint.messagePlaceholder")} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText={t("dash.form.saving")}>{values.id ? t("dash.form.save") : t("dash.maint.schedule")}</SubmitButton>
        <Link href="/dashboard/maintenance" className="text-sm font-medium text-muted hover:text-ink">
          {t("dash.form.cancel")}
        </Link>
      </div>
    </form>
  );
}
