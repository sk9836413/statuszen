import "server-only";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { recordResult } from "@/lib/monitor-state";
import { getMonitorByHeartbeatToken } from "@/lib/monitors";
import { rateLimit } from "@/lib/rate-limit";

export type PingAction = "success" | "start" | "fail";

export interface PingResponse {
  status: number;
  body: string;
}

const text = (status: number, body: string): PingResponse => ({ status, body });

export function parsePingAction(value: string | null | undefined): PingAction | null {
  if (!value || value === "success" || value === "ok") return "success";
  if (value === "start" || value === "fail") return value;
  return null;
}

/**
 * Handle a heartbeat ping: GET/POST/HEAD /api/ping/{token}[/start|/fail].
 * success: records an "up" check and recovers a down monitor right away.
 * start:   remembers that the job started (runtime is measured on success).
 * fail:    the job reported an error: down immediately, incident + alerts.
 */
export async function handlePing(token: string, action: PingAction, runtimeMs: number | null): Promise<PingResponse> {
  if (!/^[A-Za-z0-9]{16,40}$/.test(token)) return text(404, "Not found");
  if (!rateLimit(`ping:${token}`, 60, 60_000)) return text(429, "Too many pings (limit 60 per minute)");
  const monitor = await getMonitorByHeartbeatToken(token);
  if (!monitor || monitor.type !== "heartbeat") return text(404, "Not found");
  if (!monitor.isActive) return text(200, "paused");

  const db = await getDb();
  const at = new Date();
  const nowIso = at.toISOString();

  if (action === "start") {
    await db.updateTable("monitors").set({ run_started_at: nowIso }).where("id", "=", monitor.id).execute();
    return text(200, "OK");
  }

  const grace = (monitor.config as { graceSec?: number }).graceSec ?? 300;
  const interval = Math.max(30, monitor.intervalSec);
  const startedMs = monitor.runStartedAt ? at.getTime() - Date.parse(monitor.runStartedAt) : null;
  const ms = runtimeMs ?? (startedMs !== null && startedMs >= 0 && startedMs < 7 * 86_400_000 ? startedMs : null);
  const next = new Date(at.getTime() + (interval + grace) * 1000).toISOString();

  await recordResult(
    monitor,
    action === "fail"
      ? { ok: false, statusCode: null, responseMs: ms, error: "The job reported a failure" }
      : { ok: true, statusCode: null, responseMs: ms, error: null },
    { at, nextCheckAt: next, immediateDown: true, extra: { last_ping_at: nowIso, run_started_at: null } },
  );
  return text(200, "OK");
}

export function runtimeFromQuery(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), 2_147_000_000) : null;
}

const PING_HEADERS = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/** Shared by /api/ping/[token] and /api/ping/[token]/[action]. */
export async function respondToPing(request: NextRequest, token: string, actionParam: string | null, head = false): Promise<Response> {
  const action = parsePingAction(actionParam);
  if (!action) return new Response(head ? null : "Unknown action. Use /start or /fail.", { status: 404, headers: PING_HEADERS });
  try {
    const result = await handlePing(token, action, runtimeFromQuery(request.nextUrl.searchParams.get("ms")));
    return new Response(head ? null : result.body, { status: result.status, headers: PING_HEADERS });
  } catch (error) {
    console.error("[statuszen] ping failed:", error);
    return new Response(head ? null : "Error", { status: 500, headers: PING_HEADERS });
  }
}
