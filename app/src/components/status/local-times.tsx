"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TIME_FORMATS } from "./format";

/**
 * Rewrites every <time data-sz-time> in the visitor's time zone and keeps doing so
 * after refreshes. Also refreshes the page every minute while it is visible.
 */
export function LocalTimes({ locale, refreshSec = 60 }: { locale: string; refreshSec?: number }) {
  const router = useRouter();

  useEffect(() => {
    let fmt: Record<string, Intl.DateTimeFormat> = {};
    try {
      for (const [key, opts] of Object.entries(TIME_FORMATS)) fmt[key] = new Intl.DateTimeFormat(locale, opts);
    } catch {
      fmt = {};
    }
    const convert = () => {
      document.querySelectorAll<HTMLTimeElement>("time[data-sz-time]").forEach((el) => {
        const f = fmt[el.dataset.szTime ?? ""];
        if (!f || (el.dataset.szDone && el.textContent === el.dataset.szDone)) return;
        const d = new Date(el.dateTime);
        if (Number.isNaN(d.getTime())) return;
        const text = f.format(d);
        el.dataset.szDone = text;
        el.title = d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
        if (el.textContent !== text) el.textContent = text;
      });
    };
    convert();
    const observer = new MutationObserver(convert);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);

  useEffect(() => {
    if (!refreshSec) return;
    let last = Date.now();
    const refresh = () => {
      last = Date.now();
      router.refresh();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, refreshSec * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > refreshSec * 1000) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, refreshSec]);

  return null;
}
