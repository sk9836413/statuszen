import "server-only";
import net from "node:net";
import { isPrivateAddress } from "@/lib/net/ssrf";
import type { Translator } from "@/lib/i18n/messages";
import { channelProblem, configProblem, hostOnly } from "@/monitor/normalize";
import type { ChannelType, MonitorType } from "@/monitor/types";

/** Shared helpers for the dashboard Server Actions (not an action module itself). */

export const idOf = (v: FormDataEntryValue | null) => Number(typeof v === "string" && v.trim() ? v : NaN);
export const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
export const ids = (values: FormDataEntryValue[]) => [...new Set(values.map((v) => idOf(v)).filter((n) => Number.isInteger(n) && n > 0))];

export function parseJsonField(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(str(v) || "{}");
  } catch {
    return {};
  }
}

/** configProblem(), translated. */
export function monitorConfigError(type: MonitorType, config: Record<string, unknown>, t: Translator): string {
  const problem = configProblem(type, config);
  if (!problem) return "";
  if ((type === "http" || type === "keyword") && !config.url) return t("dash.err.url");
  if (type === "keyword" && !config.keyword) return t("dash.err.keyword");
  if ((type === "tcp" || type === "ssl" || type === "dns") && !config.host) return t("dash.err.host");
  if (type === "domain" && !config.domain) return t("dash.err.domain");
  return problem;
}

/** channelProblem(), translated. */
export function channelConfigError(type: ChannelType, config: Record<string, unknown>, t: Translator): string {
  const problem = channelProblem(type, config);
  if (!problem) return "";
  if (type === "email") return t("dash.err.channelEmail");
  if (type === "webhook") return t("dash.err.channelWebhook");
  if (type === "telegram") return t("dash.err.channelTelegram");
  return t("dash.err.channelIncoming");
}

/** Obvious private targets (localhost, private IP literals). DNS-based checks happen in the check engine. */
export function isPrivateTarget(type: MonitorType, config: Record<string, unknown>): boolean {
  const raw = type === "http" || type === "keyword" ? config.url : type === "domain" ? config.domain : config.host;
  if (type === "heartbeat" || type === "domain" || !raw) return false;
  const host = hostOnly(String(raw));
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  return net.isIP(host) !== 0 && isPrivateAddress(host);
}
