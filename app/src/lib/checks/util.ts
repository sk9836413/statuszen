import "server-only";
import dns from "node:dns";
import net from "node:net";
import { guardedLookup, isPrivateAddress } from "@/lib/net/ssrf";
import type { CheckResult } from "@/monitor/types";

export interface CheckOptions {
  /** Skip the private-address guard (Admin → Settings → allow private targets). */
  allowPrivate: boolean;
}

export const PRIVATE_BLOCKED = "Private and local addresses can't be monitored";

export function fail(error: string, extra: Partial<CheckResult> = {}): CheckResult {
  return { ok: false, statusCode: null, responseMs: null, error: error.slice(0, 480), ...extra };
}

/** `lookup` for net/tls/undici connections: guarded unless private targets are allowed. */
export function lookupFor(allowPrivate: boolean): typeof dns.lookup | undefined {
  return allowPrivate ? undefined : (guardedLookup as unknown as typeof dns.lookup);
}

/** For IP literals the lookup is skipped by Node, so check them up front. */
export function blockedLiteral(host: string, allowPrivate: boolean): boolean {
  const bare = host.replace(/^\[|\]$/g, "");
  if (allowPrivate || !net.isIP(bare)) return false;
  return isPrivateAddress(bare);
}

export function blockedName(host: string, allowPrivate: boolean): boolean {
  if (allowPrivate) return false;
  const h = host.toLowerCase().replace(/\.$/, "");
  return h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal");
}

const TLS_ERRORS: Record<string, string> = {
  CERT_HAS_EXPIRED: "the certificate has expired",
  CERT_NOT_YET_VALID: "the certificate is not valid yet",
  DEPTH_ZERO_SELF_SIGNED_CERT: "self-signed certificate",
  SELF_SIGNED_CERT_IN_CHAIN: "self-signed certificate in the chain",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "unable to verify the certificate (incomplete chain)",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "unable to verify the certificate (unknown issuer)",
  UNABLE_TO_GET_ISSUER_CERT: "unable to verify the certificate (unknown issuer)",
  ERR_TLS_CERT_ALTNAME_INVALID: "the certificate does not match the hostname",
  CERT_REVOKED: "the certificate was revoked",
  ERR_SSL_WRONG_VERSION_NUMBER: "the server does not speak TLS on this port",
};

export function tlsErrorText(code: string | undefined): string | null {
  if (!code) return null;
  if (TLS_ERRORS[code]) return TLS_ERRORS[code];
  if (/CERT|SSL|TLS/.test(code)) return code.toLowerCase().replace(/_/g, " ");
  return null;
}

/** Turn a network error (Node, undici) into a short message for alerts and the dashboard. */
export function networkErrorText(error: unknown, timeoutSec: number): string {
  const e = error as { name?: string; code?: string; message?: string; cause?: { code?: string; name?: string; message?: string } };
  const code = e?.cause?.code ?? e?.code;
  const name = e?.cause?.name ?? e?.name;
  if (name === "TimeoutError" || name === "AbortError" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "UND_ERR_HEADERS_TIMEOUT" || code === "ETIMEDOUT" || code === "UND_ERR_BODY_TIMEOUT") {
    return `Timed out after ${timeoutSec} s`;
  }
  const tls = tlsErrorText(code);
  if (tls) return `SSL certificate error: ${tls}`;
  switch (code) {
    case "EBLOCKED":
      return PRIVATE_BLOCKED;
    case "ECONNREFUSED":
      return "Connection refused";
    case "ENOTFOUND":
    case "EAI_AGAIN":
    case "EAI_FAIL":
    case "EAI_NONAME":
    case "ENODATA":
      return "DNS lookup failed";
    case "ECONNRESET":
    case "UND_ERR_SOCKET":
      return "Connection reset by the server";
    case "EHOSTUNREACH":
    case "ENETUNREACH":
      return "Host unreachable";
    case "EPROTO":
      return "SSL/TLS handshake failed";
  }
  const message = e?.cause?.message ?? e?.message ?? "";
  return message ? `Connection failed: ${message}`.slice(0, 300) : "Connection failed";
}

export const elapsed = (start: bigint) => Math.max(0, Math.round(Number(process.hrtime.bigint() - start) / 1e6));
