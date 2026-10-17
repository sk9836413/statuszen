import "server-only";
import type { MonitorRecord } from "@/lib/monitors";
import type { CheckResult, ConfigByType } from "@/monitor/types";
import { checkDns } from "./dns";
import { checkDomain } from "./domain";
import { checkHttp } from "./http";
import { checkSsl } from "./ssl";
import { checkTcp } from "./tcp";
import { fail, type CheckOptions } from "./util";

export type { CheckOptions } from "./util";

/**
 * Run one check for a monitor. Never throws: failures come back as
 * `{ ok: false, error }` with a short, human-readable reason.
 * Heartbeat monitors have no network check (the scheduler handles missed pings).
 */
export async function runCheck(monitor: MonitorRecord, opts: CheckOptions): Promise<CheckResult> {
  try {
    switch (monitor.type) {
      case "http":
        return await checkHttp(monitor.config as ConfigByType["http"], opts);
      case "keyword": {
        const config = monitor.config as ConfigByType["keyword"];
        return await checkHttp(config, opts, config);
      }
      case "tcp":
        return await checkTcp(monitor.config as ConfigByType["tcp"], opts);
      case "ssl":
        return await checkSsl(monitor.config as ConfigByType["ssl"], opts);
      case "domain":
        return await checkDomain(monitor.config as ConfigByType["domain"]);
      case "dns":
        return await checkDns(monitor.config as ConfigByType["dns"]);
      case "heartbeat":
        return { ok: true, statusCode: null, responseMs: null, error: null };
    }
    return fail("Unknown monitor type");
  } catch (error) {
    return fail(error instanceof Error ? `Check failed: ${error.message}` : "Check failed");
  }
}

/** Expected worst-case duration of a check (used to plan the scheduler's time budget). */
export function checkTimeoutMs(monitor: MonitorRecord): number {
  const c = monitor.config as { timeoutSec?: number };
  if (monitor.type === "http" || monitor.type === "keyword" || monitor.type === "tcp") return (c.timeoutSec ?? 15) * 1000;
  if (monitor.type === "domain") return 15_000;
  if (monitor.type === "heartbeat") return 0;
  return 10_000;
}
