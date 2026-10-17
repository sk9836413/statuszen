"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CircleCheck, CircleX, Loader, Plus, X } from "lucide-react";
import { checkSlugAction, createStatusPageAction, saveStatusPageAction, type SlugCheck } from "@/app/actions/dashboard/status-pages";
import { initialFormState, type FormState } from "@/app/actions/types";
import { Button } from "@/components/ui/button";
import { Field, Hint, Input, Label, Select, Switch, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { Segmented } from "@/components/ui/segmented";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { normalizeSlug } from "@/monitor/normalize";
import type { MonitorStatus, MonitorType, StatusPageSettings } from "@/monitor/types";
import { FormSection } from "./monitor-form";
import { StatusDot, TYPE_ICONS } from "./monitor-meta";

/** Slug input with a debounced availability check. */
function SlugField({ id, value, onChange, pageId, prefix }: { id: string; value: string; onChange: (v: string) => void; pageId?: number; prefix: string }) {
  const t = useT();
  const [check, setCheck] = useState<SlugCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [initial] = useState(value);
  const slug = normalizeSlug(value);

  useEffect(() => {
    if (!slug || (pageId && slug === initial)) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await checkSlugAction(slug, pageId);
        if (!cancelled) setCheck(result);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, pageId, initial]);

  const unchanged = Boolean(pageId) && slug === initial;
  const current = check && check.slug === slug && !unchanged ? check : null;
  return (
    <div>
      <div className="flex rounded-lg border border-line bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <span className="flex max-w-[50%] shrink-0 items-center truncate border-e border-line bg-paper px-3 text-sm text-muted ltr:rounded-l-lg rtl:rounded-r-lg" dir="ltr">
          {prefix}
        </span>
        <input
          id={id}
          name="slug"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setChecking(true);
          }}
          required
          maxLength={50}
          dir="ltr"
          spellCheck={false}
          autoComplete="off"
          aria-describedby={`${id}-status`}
          className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm focus:outline-none"
        />
      </div>
      <p id={`${id}-status`} aria-live="polite" className="mt-1.5 flex min-h-5 items-center gap-1.5 text-xs">
        {unchanged || !slug ? (
          <span className="text-muted">{t("dash.pages.slugHint")}</span>
        ) : checking && !current ? (
          <span className="inline-flex items-center gap-1.5 text-muted">
            <Loader className="size-3.5 animate-spin" aria-hidden />
            {t("dash.pages.slugChecking")}
          </span>
        ) : current ? (
          <span className={cn("inline-flex items-center gap-1.5", current.available ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
            {current.available ? <CircleCheck className="size-3.5" aria-hidden /> : <CircleX className="size-3.5" aria-hidden />}
            {current.message}
          </span>
        ) : null}
      </p>
    </div>
  );
}

export function NewStatusPageForm({ prefix }: { prefix: string }) {
  const t = useT();
  const uid = useId();
  const [state, action] = useActionState(createStatusPageAction, initialFormState);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("dash.pages.name")} htmlFor={`${uid}-name`}>
          <Input
            id={`${uid}-name`}
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(normalizeSlug(e.target.value));
            }}
            required
            maxLength={120}
            placeholder={t("dash.pages.namePlaceholder")}
            autoComplete="off"
          />
        </Field>
        <div>
          <Label htmlFor={`${uid}-slug`}>{t("dash.pages.slug")}</Label>
          <SlugField
            id={`${uid}-slug`}
            value={slug}
            prefix={prefix}
            onChange={(v) => {
              setSlugEdited(true);
              setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
            }}
          />
        </div>
      </div>
      <SubmitButton pendingText={t("dash.form.saving")}>{t("dash.pages.create")}</SubmitButton>
    </form>
  );
}

export interface BuilderMonitor {
  id: number;
  name: string;
  type: MonitorType;
  status: MonitorStatus;
}

export interface BuilderComponent {
  monitorId: number;
  displayName: string;
  groupName: string;
}

export interface BuilderPage {
  id: number;
  name: string;
  slug: string;
  description: string;
  logo: string;
  logoSrc: string;
  isPublic: boolean;
  settings: StatusPageSettings;
}

export function StatusPageBuilder({
  page,
  components: initialComponents,
  monitors,
  prefix,
}: {
  page: BuilderPage;
  components: BuilderComponent[];
  monitors: BuilderMonitor[];
  prefix: string;
}) {
  const t = useT();
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const router = useRouter();
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveStatusPageAction(prev, formData);
    if (result.success) router.refresh();
    return result;
  }, initialFormState);

  const [slug, setSlug] = useState(page.slug);
  const [theme, setTheme] = useState(page.settings.theme);
  const [customAccent, setCustomAccent] = useState(Boolean(page.settings.accent));
  const [accent, setAccent] = useState(page.settings.accent || "#1d5bd8");
  const [logoUrl, setLogoUrl] = useState(page.logo);
  const [components, setComponents] = useState<BuilderComponent[]>(initialComponents);
  const [adding, setAdding] = useState("");

  const byId = new Map(monitors.map((m) => [m.id, m]));
  const available = monitors.filter((m) => !components.some((c) => c.monitorId === m.id));
  const move = (i: number, dir: -1 | 1) =>
    setComponents((list) => {
      const next = [...list];
      const j = i + dir;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const update = (i: number, patch: Partial<BuilderComponent>) => setComponents((list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const groups = [...new Set(components.map((c) => c.groupName.trim()).filter(Boolean))];

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="page_id" value={page.id} />
      <input type="hidden" name="components" value={JSON.stringify(components)} />
      <input type="hidden" name="theme" value={theme} />
      <FormMessage state={state} />

      <FormSection title={t("dash.pages.general")} description={t("dash.pages.generalText")}>
        <Field label={t("dash.pages.name")} htmlFor={id("name")}>
          <Input id={id("name")} name="name" defaultValue={page.name} required maxLength={120} />
        </Field>
        <div>
          <Label htmlFor={id("slug")}>{t("dash.pages.slug")}</Label>
          <SlugField id={id("slug")} value={slug} onChange={(v) => setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} pageId={page.id} prefix={prefix} />
        </div>
        <Field label={t("dash.pages.description")} htmlFor={id("desc")} hint={t("dash.pages.descriptionHint")}>
          <Textarea id={id("desc")} name="description" defaultValue={page.description} maxLength={500} className="min-h-20" />
        </Field>
        <Switch name="is_public" label={t("dash.pages.public")} description={t("dash.pages.publicHint")} defaultChecked={page.isPublic} />
      </FormSection>

      <FormSection title={t("dash.pages.logo")} description={t("dash.pages.logoText")}>
        {page.logoSrc ? (
          <div className="flex items-center gap-4 rounded-lg border border-line bg-paper p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo of unknown size */}
            <img src={page.logoSrc} alt="" className="h-10 max-w-40 object-contain" />
            <label className="ms-auto inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="logo_remove" className="size-4 accent-[var(--primary)]" />
              {t("dash.pages.logoRemove")}
            </label>
          </div>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("dash.pages.logoUpload")} htmlFor={id("logo-file")} hint={t("dash.pages.logoUploadHint")}>
            <input
              id={id("logo-file")}
              name="logo_file"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="block w-full text-sm text-muted file:me-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:border-primary-line"
            />
          </Field>
          <Field label={t("dash.pages.logoUrl")} htmlFor={id("logo-url")} hint={t("dash.pages.logoUrlHint")}>
            <Input id={id("logo-url")} name="logo_url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.svg" dir="ltr" spellCheck={false} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={t("dash.pages.appearance")} description={t("dash.pages.appearanceText")}>
        <div>
          <Label>{t("dash.pages.theme")}</Label>
          <Segmented
            value={theme}
            onChange={setTheme}
            label={t("dash.pages.theme")}
            options={[
              { value: "auto", label: t("dash.pages.themeAuto") },
              { value: "light", label: t("dash.pages.themeLight") },
              { value: "dark", label: t("dash.pages.themeDark") },
            ]}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor={id("accent")}>{t("dash.pages.accent")}</Label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="accent_custom" checked={customAccent} onChange={(e) => setCustomAccent(e.target.checked)} className="size-4 accent-[var(--primary)]" />
                {t("dash.pages.accentCustom")}
              </label>
              <input
                id={id("accent")}
                type="color"
                name="accent"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                disabled={!customAccent}
                aria-label={t("dash.pages.accent")}
                className="h-9 w-14 cursor-pointer rounded-md border border-line bg-surface p-1 disabled:cursor-not-allowed disabled:opacity-40"
              />
              {customAccent ? (
                <span className="font-mono text-xs text-muted" dir="ltr">
                  {accent}
                </span>
              ) : null}
            </div>
            <Hint>{t("dash.pages.accentHint")}</Hint>
          </div>
          <Field label={t("dash.pages.history")} htmlFor={id("history")}>
            <Select id={id("history")} name="history_days" defaultValue={page.settings.historyDays}>
              {[30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {t("dash.pages.historyDays", { n: d })}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="space-y-4">
          <Switch name="show_uptime" label={t("dash.pages.showUptime")} description={t("dash.pages.showUptimeHint")} defaultChecked={page.settings.showUptimePercent} />
          <Switch name="show_response" label={t("dash.pages.showResponse")} description={t("dash.pages.showResponseHint")} defaultChecked={page.settings.showResponseTimes} />
          <Switch name="allow_subscribe" label={t("dash.pages.allowSubscribe")} description={t("dash.pages.allowSubscribeHint")} defaultChecked={page.settings.allowSubscribe} />
          <Switch name="noindex" label={t("dash.pages.noindex")} description={t("dash.pages.noindexHint")} defaultChecked={page.settings.noindex} />
        </div>
      </FormSection>

      <FormSection title={t("dash.pages.content")} description={t("dash.pages.contentText")}>
        <Field label={t("dash.pages.announcement")} htmlFor={id("announce")} hint={t("dash.pages.announcementHint")}>
          <Textarea id={id("announce")} name="announcement" defaultValue={page.settings.announcement} maxLength={300} className="min-h-20" />
        </Field>
        <Field label={t("dash.pages.website")} htmlFor={id("website")} hint={t("dash.pages.websiteHint")}>
          <Input id={id("website")} name="website_url" type="url" defaultValue={page.settings.websiteUrl} placeholder="https://example.com" dir="ltr" spellCheck={false} />
        </Field>
      </FormSection>

      <FormSection title={t("dash.pages.components")} description={t("dash.pages.componentsText")}>
        {components.length ? (
          <ol className="divide-y divide-line rounded-lg border border-line">
            {components.map((c, i) => {
              const m = byId.get(c.monitorId);
              if (!m) return null;
              const Icon = TYPE_ICONS[m.type];
              return (
                <li key={c.monitorId} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="size-8 px-0" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("dash.pages.moveUp", { name: m.name })}>
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button variant="ghost" size="sm" className="size-8 px-0" onClick={() => move(i, 1)} disabled={i === components.length - 1} aria-label={t("dash.pages.moveDown", { name: m.name })}>
                      <ArrowDown aria-hidden />
                    </Button>
                  </div>
                  <div className="flex min-w-40 flex-1 items-center gap-2">
                    <StatusDot status={m.status} size="sm" />
                    <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />
                    <span className="truncate text-sm font-medium">{m.name}</span>
                  </div>
                  <Input
                    aria-label={t("dash.pages.displayName", { name: m.name })}
                    placeholder={t("dash.pages.displayNamePlaceholder")}
                    value={c.displayName}
                    onChange={(e) => update(i, { displayName: e.target.value })}
                    maxLength={120}
                    className="h-9 w-full sm:w-44"
                  />
                  <Input
                    aria-label={t("dash.pages.group", { name: m.name })}
                    placeholder={t("dash.pages.groupPlaceholder")}
                    value={c.groupName}
                    onChange={(e) => update(i, { groupName: e.target.value })}
                    maxLength={80}
                    list={id("groups")}
                    className="h-9 w-full sm:w-36"
                  />
                  <Button variant="ghost" size="sm" className="size-8 px-0 hover:text-red-600" onClick={() => setComponents((list) => list.filter((_, j) => j !== i))} aria-label={t("ui.remove", { name: m.name })}>
                    <X aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">{t("dash.pages.noComponents")}</p>
        )}
        <datalist id={id("groups")}>
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        {available.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-64">
            <Select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label={t("dash.pages.addMonitor")} className="h-9">
              <option value="">{t("dash.pages.chooseMonitor")}</option>
              {available.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!adding}
              onClick={() => {
                setComponents((list) => [...list, { monitorId: Number(adding), displayName: "", groupName: "" }]);
                setAdding("");
              }}
            >
              <Plus aria-hidden />
              {t("dash.pages.add")}
            </Button>
            {available.length > 1 ? (
              <Button variant="ghost" size="sm" onClick={() => setComponents((list) => [...list, ...available.map((m) => ({ monitorId: m.id, displayName: "", groupName: "" }))])}>
                {t("dash.pages.addAll", { n: available.length })}
              </Button>
            ) : null}
          </div>
        ) : null}
      </FormSection>

      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-wrap items-center gap-3 rounded-b-xl border-t border-line bg-surface/95 px-5 py-4 backdrop-blur">
        <SubmitButton pendingText={t("dash.form.saving")}>{t("dash.form.save")}</SubmitButton>
        <p className="text-xs text-muted">{t("dash.pages.saveHint")}</p>
      </div>
    </form>
  );
}
