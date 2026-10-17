import "server-only";
import net from "node:net";
import tls from "node:tls";
import type { CheckResult, SslConfig } from "@/monitor/types";
import { PRIVATE_BLOCKED, blockedLiteral, blockedName, elapsed, fail, lookupFor, networkErrorText, tlsErrorText, type CheckOptions } from "./util";

const TIMEOUT_SEC = 10;

const isoDate = (value: string | undefined): string | null => {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

const day = (iso: string) => iso.slice(0, 10);

/**
 * TLS handshake with SNI. Fails when the certificate is expired, not yet valid,
 * untrusted or doesn't match the host. A certificate that expires soon is still
 * "up": the scheduler sends an ssl_expiring alert instead.
 */
export function checkSsl(config: SslConfig, opts: CheckOptions): Promise<CheckResult> {
  const host = config.host.replace(/^\[|\]$/g, "");
  if (!host) return Promise.resolve(fail("No host configured"));
  if (blockedLiteral(host, opts.allowPrivate) || blockedName(host, opts.allowPrivate)) return Promise.resolve(fail(PRIVATE_BLOCKED));

  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    let settled = false;
    const socket = tls.connect({
      host,
      port: config.port || 443,
      servername: net.isIP(host) ? undefined : host,
      lookup: lookupFor(opts.allowPrivate),
      // Inspect and report invalid certificates instead of failing the handshake.
      rejectUnauthorized: false,
    });
    const finish = (result: CheckResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => finish(fail(`Timed out after ${TIMEOUT_SEC} s`)), TIMEOUT_SEC * 1000);
    socket.once("error", (error) => finish(fail(networkErrorText(error, TIMEOUT_SEC))));
    socket.once("secureConnect", () => {
      const responseMs = elapsed(start);
      const cert = socket.getPeerCertificate();
      if (!cert || !cert.valid_to) return finish(fail("The server did not present a certificate", { responseMs }));
      const validTo = isoDate(cert.valid_to);
      const validFrom = isoDate(cert.valid_from);
      const extra = { responseMs, sslExpiresAt: validTo };
      const nowIso = new Date().toISOString();
      if (validTo && validTo < nowIso) return finish(fail(`SSL certificate expired on ${day(validTo)}`, extra));
      if (validFrom && validFrom > nowIso) return finish(fail(`SSL certificate is not valid until ${day(validFrom)}`, extra));
      if (!net.isIP(host) && tls.checkServerIdentity(host, cert) !== undefined) {
        return finish(fail(`SSL certificate does not match ${host}`, extra));
      }
      if (!socket.authorized) {
        const code = socket.authorizationError ? String((socket.authorizationError as Error & { code?: string }).code ?? socket.authorizationError) : "";
        if (code !== "ERR_TLS_CERT_ALTNAME_INVALID") {
          return finish(fail(`SSL certificate error: ${tlsErrorText(code) ?? (code || "untrusted certificate")}`, extra));
        }
      }
      finish({ ok: true, statusCode: null, error: null, ...extra });
    });
  });
}
