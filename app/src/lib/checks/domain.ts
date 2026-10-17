import "server-only";
import { Agent, fetch as undiciFetch } from "undici";
import { guardedLookup, isPrivateAddress } from "@/lib/net/ssrf";
import type { CheckResult, DomainConfig } from "@/monitor/types";
import { elapsed, fail } from "./util";

/**
 * Domain registration expiry from RDAP (the structured successor of WHOIS).
 * The registry's RDAP server comes from IANA's bootstrap file, with rdap.org
 * as a fallback. Lookups only fail the monitor when the domain has expired or
 * isn't registered; registry hiccups and TLDs without RDAP count as "up".
 */

const IANA_BOOTSTRAP = "https://data.iana.org/rdap/dns.json";
const RDAP_FALLBACK = "https://rdap.org/";
const TIMEOUT_MS = 15_000;
const BOOTSTRAP_TTL_MS = 24 * 3_600_000;

const agent = new Agent({ connect: { lookup: guardedLookup, timeout: 8_000 }, headersTimeout: 10_000, bodyTimeout: 10_000 });

const globalForRdap = globalThis as unknown as { __statuszenRdap?: { at: number; map: Map<string, string> } };

type JsonResult = { status: number; data: unknown };

async function getJson(start: string, signal: AbortSignal): Promise<JsonResult> {
  let url = new URL(start);
  for (let hop = 0; hop < 5; hop++) {
    const res = await undiciFetch(url, {
      redirect: "manual",
      dispatcher: agent,
      signal,
      headers: { Accept: "application/rdap+json, application/json", "User-Agent": "Statuszen-Monitor/1.0" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => undefined);
      url = new URL(location, url);
      if (url.protocol !== "https:" && url.protocol !== "http:") break;
      const host = url.hostname.replace(/^\[|\]$/g, "");
      if (/^[\d.:a-f]+$/i.test(host) && isPrivateAddress(host)) break;
      continue;
    }
    if (res.status !== 200) {
      await res.body?.cancel().catch(() => undefined);
      return { status: res.status, data: null };
    }
    const text = await res.text();
    if (text.length > 2_000_000) return { status: 200, data: null };
    try {
      return { status: 200, data: JSON.parse(text) };
    } catch {
      return { status: 200, data: null };
    }
  }
  return { status: 0, data: null };
}

/** TLD → RDAP base URL, cached for a day. */
async function rdapBase(tld: string, signal: AbortSignal): Promise<string | null> {
  const cached = globalForRdap.__statuszenRdap;
  if (!cached || Date.now() - cached.at > BOOTSTRAP_TTL_MS) {
    try {
      const { data } = await getJson(IANA_BOOTSTRAP, signal);
      const services = (data as { services?: unknown })?.services;
      if (Array.isArray(services)) {
        const map = new Map<string, string>();
        for (const service of services) {
          if (!Array.isArray(service) || !Array.isArray(service[0]) || !Array.isArray(service[1])) continue;
          const base = (service[1] as unknown[]).find((u): u is string => typeof u === "string" && u.startsWith("https://")) ?? service[1][0];
          if (typeof base !== "string") continue;
          for (const t of service[0] as unknown[]) if (typeof t === "string") map.set(t.toLowerCase(), base.endsWith("/") ? base : `${base}/`);
        }
        globalForRdap.__statuszenRdap = { at: Date.now(), map };
      }
    } catch {
      // Fall back to rdap.org below.
    }
  }
  const map = globalForRdap.__statuszenRdap?.map;
  if (!map) return RDAP_FALLBACK;
  return map.get(tld) ?? null;
}

function expiration(data: unknown): string | null {
  const events = (data as { events?: unknown })?.events;
  if (!Array.isArray(events)) return null;
  for (const event of events) {
    const e = event as { eventAction?: unknown; eventDate?: unknown };
    if (e?.eventAction === "expiration" && typeof e.eventDate === "string" && !Number.isNaN(Date.parse(e.eventDate))) {
      return new Date(e.eventDate).toISOString();
    }
  }
  return null;
}

/** example.co.uk style parents, so "shop.example.co.uk" finds "example.co.uk". */
function candidates(domain: string): string[] {
  const labels = domain.split(".");
  const names: string[] = [];
  for (let i = 0; i <= labels.length - 2 && names.length < 3; i++) names.push(labels.slice(i).join("."));
  return names;
}

export async function checkDomain(config: DomainConfig): Promise<CheckResult> {
  const domain = config.domain.toLowerCase().replace(/\.$/, "");
  if (!domain || !domain.includes(".")) return fail("No domain configured");
  const start = process.hrtime.bigint();
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const tld = domain.split(".").pop()!;
  const unknown: CheckResult = { ok: true, statusCode: null, responseMs: null, error: null };

  try {
    const base = await rdapBase(tld, signal);
    // No RDAP service for this TLD: nothing to check, don't report the domain as down.
    if (!base) return unknown;
    let notFound = 0;
    const names = candidates(domain);
    for (const name of names) {
      const { status, data } = await getJson(`${base}domain/${encodeURIComponent(name)}`, signal);
      if (status === 404) {
        notFound += 1;
        continue;
      }
      if (status !== 200 || !data) return { ...unknown, statusCode: status || null, responseMs: elapsed(start) };
      const expiresAt = expiration(data);
      const responseMs = elapsed(start);
      if (expiresAt && expiresAt < new Date().toISOString()) {
        return fail(`Domain expired on ${expiresAt.slice(0, 10)}`, { statusCode: 200, responseMs, domainExpiresAt: expiresAt });
      }
      return { ok: true, statusCode: 200, responseMs, error: null, domainExpiresAt: expiresAt };
    }
    if (notFound === names.length) return fail(`Domain ${domain} is not registered (not found in RDAP)`, { statusCode: 404, responseMs: elapsed(start) });
    return unknown;
  } catch {
    // Registry unreachable or slow: keep the last known state.
    return unknown;
  }
}
