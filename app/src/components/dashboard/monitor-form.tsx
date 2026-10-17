"use client";

import { useActionState, useId, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { CircleCheck, CircleX, FlaskConical, Lock, Plus, X } from "lucide-react";
import { saveMonitorAction, testMonitorAction, type TestResult } from "@/app/actions/dashboard/monitors";
import { initialFormState } from "@/app/actions/types";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Hint, Input, Label, Select, Switch, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { Segmented } from "@/components/ui/segmented";
import { formatMs } from "@/lib/dash-format";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { formatInterval } from "@/monitor/format";
import { DNS_RECORD_TYPES, HTTP_METHODS, INTERVAL_CHOICES, type ChannelType, type MonitorType } from "@/monitor/types";
import { ChannelIcon } from "./monitor-meta";

export interface MonitorFormValues {
  id?: number;
  type: MonitorType;
  name: string;
  config: Record<string, unknown>;
  intervalSec: number;
  confirmCount: number;
  isActive: boolean;
  channelIds: number[];
}

export interface FormChannel {
  id: number;
  name: string;
  type: ChannelType;
  isActive: boolean;
}

const GRACE_CHOICES = [0, 60, 300, 600, 900, 1800, 3600, 7200, 21600, 86400];

/** Two-column form section: label and description on the left, fields on the right. */
export function FormSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="grid gap-5 border-t border-line pt-6 first-of-type:border-t-0 first-of-type:pt-0 md:grid-cols-[220px_1fr]">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden>
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </fieldset>
  );
}

export function MonitorForm({
  values,
  channels,
  minIntervalSec,
  locale,
}: {
  values: MonitorFormValues;
  channels: FormChannel[];
  minIntervalSec: number;
  locale: string;
}) {
  const t = useT();
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [state, action] = useActionState(saveMonitorAction, initialFormState);
  const type = values.type;
  const isHttp = type === "http" || type === "keyword";

  const [config, setConfig] = useState<Record<string, unknown>>(values.config);
  const set = (key: string, value: unknown) => setConfig((c) => ({ ...c, [key]: value }));
  const val = (key: string) => (config[key] === undefined || config[key] === null ? "" : String(config[key]));
  const headers = (Array.isArray(config.headers) ? config.headers : []) as Array<{ name: string; value: string }>;
  const setHeaders = (next: Array<{ name: string; value: string }>) => set("headers", next);

  // Keep a locked interval selectable only if it is the saved one, so editing never silently changes it.
  const firstAllowed = INTERVAL_CHOICES.find((s) => s >= minIntervalSec) ?? INTERVAL_CHOICES[INTERVAL_CHOICES.length - 1];
  const [intervalSec, setIntervalSec] = useState(values.intervalSec >= minIntervalSec ? values.intervalSec : firstAllowed);
  const anyLocked = INTERVAL_CHOICES.some((s) => s < minIntervalSec);

  const [testing, startTest] = useTransition();
  const [test, setTest] = useState<TestResult | null>(null);
  const runTest = () => {
    const fd = new FormData();
    fd.set("type", type);
    fd.set("config", JSON.stringify(config));
    setTest(null);
    startTest(async () => {
      try {
        setTest(await testMonitorAction(fd));
      } catch {
        setTest({ ok: false, invalid: true, error: t("dash.err.generic") });
      }
    });
  };

  // Open the advanced request settings when they were changed from the defaults.
  const [advancedOpen] = useState(
    () =>
      isHttp &&
      (val("method") !== "GET" || headers.length > 0 || Boolean(val("body")) || val("expectedStatus") !== "200-299" || val("maxResponseMs") !== "0" || config.followRedirects === false),
  );

  return (
    <form action={action} className="space-y-6">
      {values.id ? <input type="hidden" name="monitor_id" value={values.id} /> : null}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="config" value={JSON.stringify(config)} />
      <FormMessage state={state} />

      <FormSection title={t("dash.form.basics")} description={t(`dash.typeDesc.${type}` as MessageKey)}>
        <Field label={t("dash.form.name")} htmlFor={id("name")} hint={t("dash.form.nameHint")}>
          <Input id={id("name")} name="name" defaultValue={values.name} maxLength={120} placeholder={t(`dash.form.namePlaceholder.${type}` as MessageKey)} autoComplete="off" />
        </Field>

        {isHttp ? (
          <Field label={t("dash.form.url")} htmlFor={id("url")} hint={t("dash.form.urlHint")}>
            <Input
              id={id("url")}
              value={val("url")}
              onChange={(e) => set("url", e.target.value)}
              required
              type="url"
              inputMode="url"
              placeholder="https://example.com"
              dir="ltr"
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
        ) : null}

        {type === "keyword" ? (
          <>
            <Field label={t("dash.form.keyword")} htmlFor={id("keyword")} hint={t("dash.form.keywordHint")}>
              <Input id={id("keyword")} value={val("keyword")} onChange={(e) => set("keyword", e.target.value)} required maxLength={500} autoComplete="off" />
            </Field>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div>
                <Label>{t("dash.form.keywordMode")}</Label>
                <Segmented
                  value={(val("keywordMode") || "present") as "present" | "absent"}
                  onChange={(v) => set("keywordMode", v)}
                  label={t("dash.form.keywordMode")}
                  options={[
                    { value: "present", label: t("dash.form.keywordPresent") },
                    { value: "absent", label: t("dash.form.keywordAbsent") },
                  ]}
                />
              </div>
              <Checkbox label={t("dash.form.caseSensitive")} checked={config.caseSensitive === true} onChange={(e) => set("caseSensitive", e.target.checked)} className="mt-6" />
            </div>
          </>
        ) : null}

        {type === "tcp" || type === "ssl" || type === "dns" ? (
          <div className={cn("grid gap-5", type !== "dns" && "sm:grid-cols-[1fr_140px]")}>
            <Field label={t("dash.form.host")} htmlFor={id("host")} hint={t("dash.form.hostHint")}>
              <Input id={id("host")} value={val("host")} onChange={(e) => set("host", e.target.value)} required placeholder="example.com" dir="ltr" spellCheck={false} autoComplete="off" />
            </Field>
            {type !== "dns" ? (
              <Field label={t("dash.form.port")} htmlFor={id("port")}>
                <Input id={id("port")} type="number" min={1} max={65535} value={val("port")} onChange={(e) => set("port", e.target.value)} required dir="ltr" />
              </Field>
            ) : null}
          </div>
        ) : null}

        {type === "dns" ? (
          <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
            <Field label={t("dash.form.recordType")} htmlFor={id("record")}>
              <Select id={id("record")} value={val("recordType")} onChange={(e) => set("recordType", e.target.value)}>
                {DNS_RECORD_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("dash.form.expected")} htmlFor={id("expected")} hint={t("dash.form.expectedHint")}>
              <Input id={id("expected")} value={val("expected")} onChange={(e) => set("expected", e.target.value)} maxLength={255} placeholder="203.0.113.10" dir="ltr" spellCheck={false} />
            </Field>
          </div>
        ) : null}

        {type === "domain" ? (
          <Field label={t("dash.form.domain")} htmlFor={id("domain")} hint={t("dash.form.domainHint")}>
            <Input id={id("domain")} value={val("domain")} onChange={(e) => set("domain", e.target.value)} required placeholder="example.com" dir="ltr" spellCheck={false} autoComplete="off" />
          </Field>
        ) : null}

        {type === "ssl" || type === "domain" ? (
          <Field label={t("dash.form.warnDays")} htmlFor={id("warn")} hint={t("dash.form.warnDaysHint")}>
            <Input id={id("warn")} type="number" min={1} max={type === "ssl" ? 120 : 365} value={val("warnDays")} onChange={(e) => set("warnDays", e.target.value)} className="max-w-40" dir="ltr" />
          </Field>
        ) : null}

        {type === "tcp" ? (
          <Field label={t("dash.form.timeout")} htmlFor={id("timeout")}>
            <Input id={id("timeout")} type="number" min={1} max={60} value={val("timeoutSec")} onChange={(e) => set("timeoutSec", e.target.value)} className="max-w-40" dir="ltr" />
          </Field>
        ) : null}

        {type === "heartbeat" ? (
          <p className="rounded-lg border border-line bg-paper p-4 text-sm text-muted">{t("dash.form.heartbeatIntro")}</p>
        ) : null}
      </FormSection>

      {isHttp ? (
        <FormSection title={t("dash.form.request")} description={t("dash.form.requestText")}>
          <details open={advancedOpen} className="group rounded-lg border border-line">
            <summary className="cursor-pointer rounded-lg px-4 py-3 text-sm font-medium select-none hover:bg-paper">{t("dash.form.advanced")}</summary>
            <div className="space-y-5 border-t border-line p-4">
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label={t("dash.form.method")} htmlFor={id("method")}>
                  <Select id={id("method")} value={val("method")} onChange={(e) => set("method", e.target.value)}>
                    {HTTP_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("dash.form.expectedStatus")} htmlFor={id("status")} hint={t("dash.form.expectedStatusHint")}>
                  <Input id={id("status")} value={val("expectedStatus")} onChange={(e) => set("expectedStatus", e.target.value)} placeholder="200-299" dir="ltr" />
                </Field>
                <Field label={t("dash.form.timeout")} htmlFor={id("timeout")}>
                  <Input id={id("timeout")} type="number" min={1} max={60} value={val("timeoutSec")} onChange={(e) => set("timeoutSec", e.target.value)} dir="ltr" />
                </Field>
              </div>
              <Field label={t("dash.form.maxResponse")} htmlFor={id("maxms")} hint={t("dash.form.maxResponseHint")}>
                <Input id={id("maxms")} type="number" min={0} max={60000} step={100} value={val("maxResponseMs")} onChange={(e) => set("maxResponseMs", e.target.value)} className="max-w-40" dir="ltr" />
              </Field>
              <Switch label={t("dash.form.followRedirects")} description={t("dash.form.followRedirectsHint")} checked={config.followRedirects !== false} onChange={(e) => set("followRedirects", e.target.checked)} />

              <div>
                <Label>{t("dash.form.headers")}</Label>
                {headers.length ? (
                  <ul className="space-y-2">
                    {headers.map((h, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Input
                          aria-label={t("dash.form.headerName")}
                          placeholder={t("dash.form.headerName")}
                          value={h.name}
                          onChange={(e) => setHeaders(headers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                          className="w-2/5"
                          dir="ltr"
                          spellCheck={false}
                        />
                        <Input
                          aria-label={t("dash.form.headerValue")}
                          placeholder={t("dash.form.headerValue")}
                          value={h.value}
                          onChange={(e) => setHeaders(headers.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                          className="min-w-0 flex-1"
                          dir="ltr"
                          spellCheck={false}
                        />
                        <Button variant="ghost" size="sm" onClick={() => setHeaders(headers.filter((_, j) => j !== i))} aria-label={t("ui.remove", { name: h.name || t("dash.form.header") })}>
                          <X aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">{t("dash.form.noHeaders")}</p>
                )}
                {headers.length < 20 ? (
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setHeaders([...headers, { name: "", value: "" }])}>
                    <Plus aria-hidden />
                    {t("dash.form.addHeader")}
                  </Button>
                ) : null}
              </div>

              {["POST", "PUT", "PATCH", "DELETE"].includes(val("method")) ? (
                <Field label={t("dash.form.body")} htmlFor={id("body")} hint={t("dash.form.bodyHint")}>
                  <Textarea id={id("body")} value={val("body")} onChange={(e) => set("body", e.target.value)} maxLength={10000} className="font-mono text-[13px]" dir="ltr" spellCheck={false} />
                </Field>
              ) : null}
            </div>
          </details>
        </FormSection>
      ) : null}

      <FormSection title={t("dash.form.schedule")} description={type === "heartbeat" ? t("dash.form.scheduleHeartbeat") : t("dash.form.scheduleText")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={type === "heartbeat" ? t("dash.form.expectEvery") : t("dash.form.interval")} htmlFor={id("interval")}>
            <Select id={id("interval")} name="interval" value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))}>
              {INTERVAL_CHOICES.map((s) => (
                <option key={s} value={s} disabled={s < minIntervalSec}>
                  {s < minIntervalSec ? t("dash.form.intervalLocked", { interval: formatInterval(s, t) }) : formatInterval(s, t)}
                </option>
              ))}
            </Select>
            {type === "domain" ? <Hint>{t("dash.form.domainInterval")}</Hint> : null}
            {anyLocked ? (
              <Hint className="flex items-center gap-1">
                <Lock className="size-3 shrink-0" aria-hidden />
                <span>
                  {t("dash.form.intervalUpgrade", { interval: formatInterval(minIntervalSec, t) })}{" "}
                  <Link href="/pricing" className="font-medium text-primary hover:underline">
                    {t("dash.form.seePlans")}
                  </Link>
                </span>
              </Hint>
            ) : null}
          </Field>
          {type === "heartbeat" ? (
            <Field label={t("dash.form.grace")} htmlFor={id("grace")} hint={t("dash.form.graceHint")}>
              <Select id={id("grace")} value={val("graceSec")} onChange={(e) => set("graceSec", Number(e.target.value))}>
                {(GRACE_CHOICES.includes(Number(config.graceSec)) ? GRACE_CHOICES : [...GRACE_CHOICES, Number(config.graceSec)].sort((a, b) => a - b)).map((s) => (
                  <option key={s} value={s}>
                    {s === 0 ? t("dash.form.noGrace") : formatInterval(s, t)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label={t("dash.form.confirm")} htmlFor={id("confirm")} hint={t("dash.form.confirmHint")}>
              <Select id={id("confirm")} name="confirm" defaultValue={values.confirmCount}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? t("dash.form.confirmOne") : t("dash.form.confirmN", { n })}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        {type === "heartbeat" ? <input type="hidden" name="confirm" value={1} /> : null}
      </FormSection>

      <FormSection title={t("dash.form.alerts")} description={t("dash.form.alertsText")}>
        {channels.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {channels.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors has-checked:border-primary-line has-checked:bg-primary-soft">
                  <input type="checkbox" name="channels" value={c.id} defaultChecked={values.channelIds.includes(c.id)} className="size-4 accent-[var(--primary)]" />
                  <ChannelIcon type={c.type} className="text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block text-xs text-muted">
                      {t(`dash.channel.${c.type}` as MessageKey)}
                      {!c.isActive ? ` · ${t("dash.channels.off")}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">{t("dash.form.noChannels")}</p>
        )}
        <Link href="/dashboard/channels/new" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <Plus className="size-4" aria-hidden />
          {t("dash.form.addChannel")}
        </Link>
      </FormSection>

      <FormSection title={t("dash.form.state")}>
        <Switch name="paused" label={t("dash.form.paused")} description={t("dash.form.pausedHint")} defaultChecked={!values.isActive} />
      </FormSection>

      {test ? <TestResultBox result={test} locale={locale} /> : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <SubmitButton pendingText={t("dash.form.saving")}>{values.id ? t("dash.form.save") : t("dash.form.create")}</SubmitButton>
        {type !== "heartbeat" ? (
          <Button variant="outline" onClick={runTest} disabled={testing} aria-busy={testing}>
            <FlaskConical aria-hidden />
            {testing ? t("dash.form.testing") : t("dash.form.test")}
          </Button>
        ) : null}
        <Link href={values.id ? `/dashboard/monitors/${values.id}` : "/dashboard/monitors"} className="text-sm font-medium text-muted hover:text-ink">
          {t("dash.form.cancel")}
        </Link>
      </div>
    </form>
  );
}

function TestResultBox({ result, locale }: { result: TestResult; locale: string }) {
  const t = useT();
  if (result.invalid) {
    return (
      <div role="alert" className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{result.error}</p>
      </div>
    );
  }
  const details = [
    result.statusCode ? t("dash.test.code", { code: result.statusCode }) : null,
    result.responseMs != null ? t("dash.test.time", { time: formatMs(result.responseMs, locale) }) : null,
    result.sslExpiresAt ? t("dash.test.sslExpires", { date: new Date(result.sslExpiresAt).toLocaleDateString(locale) }) : null,
    result.domainExpiresAt ? t("dash.test.domainExpires", { date: new Date(result.domainExpiresAt).toLocaleDateString(locale) }) : null,
  ].filter(Boolean);
  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm",
        result.ok
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
      )}
    >
      {result.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div className="min-w-0">
        <p className="font-medium">{result.ok ? t("dash.test.up") : t("dash.test.down")}</p>
        {details.length ? <p className="mt-0.5 opacity-90">{details.join(" · ")}</p> : null}
        {result.error ? <p className="mt-0.5 break-words opacity-90">{result.error}</p> : null}
      </div>
    </div>
  );
}
