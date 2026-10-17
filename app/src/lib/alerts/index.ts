import "server-only";
import { getMonitorChannels, logAlert, type ChannelRecord } from "@/lib/channels";
import type { MonitorRecord } from "@/lib/monitors";
import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/site";
import type { AlertEvent, AlertPayload, ChannelConfigByType, MonitorStatus } from "@/monitor/types";
import { sendDiscord } from "./discord";
import { sendEmail } from "./email";
import type { SendContext, SendResult } from "./format";
import { sendSlack } from "./slack";
import { sendTeams } from "./teams";
import { sendTelegram } from "./telegram";
import { sendWebhook } from "./webhook";

export { notifySubscribers } from "./subscribers";
export type { SendResult } from "./format";

const TIMEOUT_MS = 8_000;

/** Dashboard link for a monitor (also the `url` field of alerts). */
export function monitorDashboardPath(monitorId: number): string {
  return `/dashboard/monitors/${monitorId}`;
}

async function sendContext(): Promise<SendContext> {
  const settings = await getSettings();
  return { siteName: settings.site_name, allowPrivate: settings.allow_private_targets, timeoutMs: TIMEOUT_MS };
}

function withTimeout(work: Promise<SendResult>, ms: number): Promise<SendResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    work,
    new Promise<SendResult>((resolve) => {
      timer = setTimeout(() => resolve({ ok: false, error: `Timed out after ${Math.round(ms / 1000)} s` }), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Send one alert to one channel. Never throws. */
export async function sendAlert(channel: ChannelRecord, payload: AlertPayload, ctx?: SendContext): Promise<SendResult> {
  const context = ctx ?? (await sendContext());
  const work = (async (): Promise<SendResult> => {
    switch (channel.type) {
      case "email":
        return sendEmail(channel.config as ChannelConfigByType["email"], payload, context);
      case "webhook":
        return sendWebhook(channel.config as ChannelConfigByType["webhook"], payload, context);
      case "slack":
        return sendSlack(channel.config as ChannelConfigByType["slack"], payload, context);
      case "discord":
        return sendDiscord(channel.config as ChannelConfigByType["discord"], payload, context);
      case "teams":
        return sendTeams(channel.config as ChannelConfigByType["teams"], payload, context);
      case "telegram":
        return sendTelegram(channel.config as ChannelConfigByType["telegram"], payload, context);
    }
    return { ok: false, error: "Unknown channel type" };
  })().catch((error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : "Sending failed" }));
  return withTimeout(work, context.timeoutMs + 500);
}

export interface AlertDetails {
  status?: MonitorStatus;
  error?: string | null;
  responseMs?: number | null;
  downSince?: string | null;
  downtimeSec?: number | null;
  expiresAt?: string | null;
}

export async function buildPayload(monitor: Pick<MonitorRecord, "id" | "name" | "type" | "target" | "status">, event: AlertEvent, details: AlertDetails = {}): Promise<AlertPayload> {
  const settings = await getSettings();
  return {
    event,
    monitor: { id: monitor.id, name: monitor.name, type: monitor.type, target: monitor.target },
    status: details.status ?? monitor.status,
    error: details.error ?? null,
    responseMs: details.responseMs ?? null,
    downSince: details.downSince ?? null,
    downtimeSec: details.downtimeSec ?? null,
    expiresAt: details.expiresAt ?? null,
    url: absoluteUrl(settings, monitor.id ? monitorDashboardPath(monitor.id) : "/dashboard"),
    sentAt: new Date().toISOString(),
  };
}

/**
 * Alert every active channel attached to a monitor, in parallel (8 s timeout
 * each), and log every attempt to alert_log. Never throws.
 */
export async function notifyMonitor(monitor: MonitorRecord, event: AlertEvent, details: AlertDetails = {}): Promise<{ sent: number; failed: number }> {
  try {
    const channels = await getMonitorChannels(monitor.id);
    if (!channels.length) return { sent: 0, failed: 0 };
    const [payload, ctx] = await Promise.all([buildPayload(monitor, event, details), sendContext()]);
    const results = await Promise.all(channels.map((channel) => sendAlert(channel, payload, ctx)));
    let sent = 0;
    await Promise.all(
      results.map((result, i) => {
        if (result.ok) sent += 1;
        return logAlert({ monitorId: monitor.id, channelId: channels[i].id, event, ok: result.ok, error: result.error ?? null }).catch(() => undefined);
      }),
    );
    return { sent, failed: results.length - sent };
  } catch (error) {
    console.error("[statuszen] alert delivery failed:", error);
    return { sent: 0, failed: 0 };
  }
}

/** The dashboard's "Send test" button: a sample alert to one channel (logged as event "test"). */
export async function sendTestAlert(channel: ChannelRecord): Promise<SendResult> {
  const ctx = await sendContext();
  const payload = await buildPayload({ id: 0, name: "Example monitor", type: "http", target: "https://example.com", status: "up" }, "test", { responseMs: 123 });
  const result = await sendAlert(channel, payload, ctx);
  await logAlert({ monitorId: null, channelId: channel.id, event: "test", ok: result.ok, error: result.error ?? null }).catch(() => undefined);
  return result;
}
