"use client";

import { useActionState, useState, useTransition } from "react";
import { initialFormState } from "@/app/actions/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { deletePlan, savePlan } from "../actions/plans";

export interface EditablePlan {
  id: number | null;
  name: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  features: string;
  maxMonitors: number;
  minIntervalSec: number;
  maxStatusPages: number;
  removeBranding: boolean;
  isFree: boolean;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

export function PlanForm({ plan, currency }: { plan: EditablePlan; currency: string }) {
  const [state, action] = useActionState(savePlan, initialFormState);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState("");

  return (
    <div className="max-w-3xl space-y-6">
      <form action={action} className="space-y-6 rounded-xl border border-line bg-surface p-6">
        <FormMessage state={state} />
        <input type="hidden" name="id" value={plan.id ?? ""} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" defaultValue={plan.name} required maxLength={100} />
          </Field>
          <Field label="Sort order" htmlFor="sort_order" hint="Lower numbers appear first.">
            <Input id="sort_order" name="sort_order" type="number" min={0} max={999} defaultValue={plan.sortOrder} />
          </Field>
          <Field label="Short description" htmlFor="description" className="sm:col-span-2">
            <Input id="description" name="description" defaultValue={plan.description} maxLength={255} />
          </Field>
          <Field label={`Monthly price (${currency})`} htmlFor="price_monthly" hint="0 hides the monthly option.">
            <Input id="price_monthly" name="price_monthly" type="number" min={0} step="0.01" defaultValue={plan.priceMonthly} />
          </Field>
          <Field label={`Yearly price (${currency})`} htmlFor="price_yearly" hint="0 hides the yearly option.">
            <Input id="price_yearly" name="price_yearly" type="number" min={0} step="0.01" defaultValue={plan.priceYearly} />
          </Field>
          <Field label="Monitors" htmlFor="max_monitors" hint="0 = unlimited.">
            <Input id="max_monitors" name="max_monitors" type="number" min={0} max={100000} defaultValue={plan.maxMonitors} required />
          </Field>
          <Field label="Status pages" htmlFor="max_status_pages" hint="0 = unlimited.">
            <Input id="max_status_pages" name="max_status_pages" type="number" min={0} max={100000} defaultValue={plan.maxStatusPages} required />
          </Field>
          <Field label="Shortest check interval (seconds)" htmlFor="min_interval_sec" hint="e.g. 300 = every 5 minutes, 60 = every minute, 30 = every 30 seconds." className="sm:col-span-2">
            <Input id="min_interval_sec" name="min_interval_sec" type="number" min={30} max={86400} defaultValue={plan.minIntervalSec} required />
          </Field>
          <Field label="Features" htmlFor="features" hint="One per line. Shown with a tick on the pricing page." className="sm:col-span-2">
            <Textarea id="features" name="features" defaultValue={plan.features} rows={5} />
          </Field>
        </div>
        <div className="space-y-4 border-t border-line pt-6">
          <Switch name="remove_branding" label="Remove branding" description='Hide the "Powered by" link on status pages.' defaultChecked={plan.removeBranding} />
          <Switch name="is_featured" label="Recommended" description="Highlight this plan on the pricing page." defaultChecked={plan.isFeatured} />
          <Switch name="is_active" label="Show on pricing page" defaultChecked={plan.isActive} />
          <Switch
            name="is_free"
            label="This is the free plan"
            description="Its limits apply to visitors and free accounts. Only one plan can be the free plan."
            defaultChecked={plan.isFree}
          />
        </div>
        <div className="flex justify-end">
          <SubmitButton>{plan.id ? "Save plan" : "Create plan"}</SubmitButton>
        </div>
      </form>

      {plan.id ? (
        <section className="rounded-xl border border-red-200 bg-surface p-6 dark:border-red-900">
          <h2 className="font-sans text-sm font-semibold tracking-normal">Delete plan</h2>
          <p className="mt-1 text-sm text-muted">Plans with active users can&apos;t be deleted. Hide them instead.</p>
          {deleteError ? <Alert tone="error" className="mt-3">{deleteError}</Alert> : null}
          <Button
            variant="danger"
            size="sm"
            className="mt-4"
            disabled={deleting}
            onClick={() => {
              if (!confirm(`Delete the ${plan.name} plan?`)) return;
              startDelete(async () => {
                const result = await deletePlan(plan.id!);
                if (result?.error) setDeleteError(result.error);
              });
            }}
          >
            {deleting ? "Deleting…" : "Delete plan"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
