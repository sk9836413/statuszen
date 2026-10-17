import "server-only";
import { Agent, fetch as undiciFetch } from "undici";
import { parseExpectedStatus } from "@/monitor/normalize";
import type { CheckResult, HttpConfig, KeywordConfig } from "@/monitor/types";
import { PRIVATE_BLOCKED, blockedLiteral, blockedName, elapsed, fail, lookupFor, networkErrorText, type CheckOptions } from "./util";

const MAX_REDIRECTS = 10;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const USER_AGENT = "Mozilla/5.0 (compatible; Statuszen-Monitor/1.0; uptime check)";

type Res = Awaited<ReturnType<typeof undiciFetch>>;

function validateUrl(raw: string, allowPrivate: boolean): URL | string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Invalid URL";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "Only http:// and https:// URLs can be monitored";
  if (blockedLiteral(url.hostname, allowPrivate) || blockedName(url.hostname, allowPrivate)) return PRIVATE_BLOCKED;
  return url;
}

/** Read at most `max` bytes of the body as text. */
async function readText(res: Res, max: number): Promise<string> {
  if (!res.body) return "";
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for await (const chunk of res.body) {
    const piece = chunk as Uint8Array;
    const room = max - bytes;
    if (room <= 0) break;
    chunks.push(piece.byteLength > room ? piece.subarray(0, room) : piece);
    bytes += Math.min(piece.byteLength, room);
    if (bytes >= max) break;
  }
  await res.body.cancel().catch(() => undefined);
  return Buffer.concat(chunks).toString("utf8");
}

export async function checkHttp(config: HttpConfig | KeywordConfig, opts: CheckOptions, keyword?: KeywordConfig): Promise<CheckResult> {
  const timeoutSec = config.timeoutSec || 15;
  const first = validateUrl(config.url, opts.allowPrivate);
  if (typeof first === "string") return fail(first);

  const headers: Record<string, string> = { "User-Agent": USER_AGENT, Accept: "text/html,application/json,*/*;q=0.8" };
  // Credentials in the URL (https://user:pass@host) become a Basic auth header.
  if (first.username || first.password) {
    headers.Authorization = `Basic ${Buffer.from(`${decodeURIComponent(first.username)}:${decodeURIComponent(first.password)}`).toString("base64")}`;
    first.username = "";
    first.password = "";
  }
  for (const h of config.headers) headers[h.name] = h.value;

  let method: string = config.method;
  let body: string | undefined = ["POST", "PUT", "PATCH", "DELETE"].includes(method) && config.body ? config.body : undefined;

  // A fresh agent per check: every check measures a real DNS + connect + TLS round trip.
  const agent = new Agent({
    connect: { lookup: lookupFor(opts.allowPrivate), timeout: timeoutSec * 1000 },
    headersTimeout: timeoutSec * 1000,
    bodyTimeout: timeoutSec * 1000,
    keepAliveTimeout: 1_000,
  });
  const signal = AbortSignal.timeout(timeoutSec * 1000);
  const start = process.hrtime.bigint();
  let url = first;
  try {
    let res: Res | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      res = await undiciFetch(url, { method, headers, body, redirect: "manual", dispatcher: agent, signal });
      const location = res.headers.get("location");
      if (config.followRedirects && res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel().catch(() => undefined);
        if (hop === MAX_REDIRECTS) return fail(`Too many redirects (more than ${MAX_REDIRECTS})`, { statusCode: res.status, responseMs: elapsed(start) });
        let next: URL;
        try {
          next = new URL(location, url);
        } catch {
          return fail("Invalid redirect location", { statusCode: res.status, responseMs: elapsed(start) });
        }
        const checked = validateUrl(next.toString(), opts.allowPrivate);
        if (typeof checked === "string") return fail(`Redirected to a blocked address: ${checked}`, { statusCode: res.status, responseMs: elapsed(start) });
        // Browsers switch to GET after 303, and after 301/302 for POST.
        if (res.status === 303 ? method !== "HEAD" : (res.status === 301 || res.status === 302) && method === "POST") {
          method = "GET";
          body = undefined;
        }
        url = checked;
        continue;
      }
      break;
    }
    if (!res) return fail("No response");

    const statusCode = res.status;
    const accepted = parseExpectedStatus(config.expectedStatus);
    let text = "";
    if (keyword && method !== "HEAD" && accepted(statusCode)) text = await readText(res, MAX_BODY_BYTES);
    else await res.body?.cancel().catch(() => undefined);
    const responseMs = elapsed(start);

    if (!accepted(statusCode)) return fail(`Expected ${config.expectedStatus.replace(/\s+/g, "")}, got ${statusCode}`, { statusCode, responseMs });
    if (keyword && keyword.keyword) {
      const hay = keyword.caseSensitive ? text : text.toLowerCase();
      const needle = keyword.caseSensitive ? keyword.keyword : keyword.keyword.toLowerCase();
      const found = hay.includes(needle);
      if (keyword.keywordMode === "present" && !found) return fail(`Keyword '${keyword.keyword.slice(0, 80)}' not found`, { statusCode, responseMs });
      if (keyword.keywordMode === "absent" && found) return fail(`Keyword '${keyword.keyword.slice(0, 80)}' was found`, { statusCode, responseMs });
    }
    if (config.maxResponseMs > 0 && responseMs > config.maxResponseMs) {
      return fail(`Response took ${responseMs.toLocaleString("en-US")} ms (limit ${config.maxResponseMs.toLocaleString("en-US")} ms)`, { statusCode, responseMs });
    }
    return { ok: true, statusCode, responseMs, error: null };
  } catch (error) {
    return fail(networkErrorText(error, timeoutSec), { responseMs: null });
  } finally {
    agent.destroy().catch(() => undefined);
  }
}
