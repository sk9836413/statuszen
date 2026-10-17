"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { BellRing, CircleCheck, X } from "lucide-react";
import { subscribeToStatusPage } from "@/app/actions/status-page";
import { initialFormState } from "@/app/actions/types";

export interface SubscribeLabels {
  button: string;
  title: string;
  text: string;
  email: string;
  submit: string;
  pending: string;
  close: string;
}

function Submit({ labels }: { labels: SubscribeLabels }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-60"
    >
      {pending ? labels.pending : labels.submit}
    </button>
  );
}

/** "Subscribe" button that opens a small dialog with the double opt-in form. */
export function SubscribeButton({ slug, labels }: { slug: string; labels: SubscribeLabels }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(subscribeToStatusPage, initialFormState);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Close when clicking the backdrop.
    const onClick = (e: MouseEvent) => {
      if (e.target === dialog) dialog.close();
    };
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-strong"
      >
        <BellRing className="size-4" aria-hidden />
        {labels.button}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="sz-subscribe-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-[2px]"
      >
        <div className="relative p-6">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={labels.close}
            className="absolute end-3 top-3 grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-primary-soft hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
          <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
            <BellRing className="size-5" aria-hidden />
          </span>
          <h2 id="sz-subscribe-title" className="mt-4 font-display text-xl font-semibold">
            {labels.title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{labels.text}</p>
          {state.success ? (
            <p role="status" className="mt-5 flex gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-sm text-emerald-800 dark:text-emerald-300">
              <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.success}
            </p>
          ) : (
            <form action={action} className="mt-5">
              <input type="hidden" name="slug" value={slug} />
              <label htmlFor="sz-subscribe-email" className="mb-1.5 block text-sm font-medium">
                {labels.email}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="sz-subscribe-email"
                  name="email"
                  type="email"
                  required
                  maxLength={190}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-11 w-full min-w-0 rounded-xl border border-line bg-paper px-3.5 text-sm text-ink placeholder:text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
                <Submit labels={labels} />
              </div>
              <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label htmlFor="sz-website">Leave this field empty</label>
                <input id="sz-website" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              {state.error ? (
                <p role="alert" className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-300">
                  {state.error}
                </p>
              ) : null}
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
