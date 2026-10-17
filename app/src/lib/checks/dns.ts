import "server-only";
import { Resolver } from "node:dns/promises";
import net from "node:net";
import type { CheckResult, DnsConfig, DnsRecordType } from "@/monitor/types";
import { elapsed, fail } from "./util";

/** Public resolvers, so results don't depend on the server's own DNS setup. */
const PUBLIC_RESOLVERS = ["1.1.1.1", "8.8.8.8"];
const BUDGET_MS = 10_000;

const RESOLVE: Record<DnsRecordType, (r: Resolver, name: string) => Promise<string[]>> = {
  A: (r, n) => r.resolve4(n),
  AAAA: (r, n) => r.resolve6(n),
  CNAME: (r, n) => r.resolveCname(n),
  MX: async (r, n) => (await r.resolveMx(n)).sort((a, b) => a.priority - b.priority).map((mx) => `${mx.priority} ${mx.exchange}`),
  TXT: async (r, n) => (await r.resolveTxt(n)).map((chunks) => chunks.join("")),
  NS: async (r, n) => (await r.resolveNs(n)).sort(),
};

const ERRORS: Record<string, string> = {
  ENOTFOUND: "Domain does not exist (NXDOMAIN)",
  ETIMEOUT: "DNS servers did not answer in time",
  ECANCELLED: "DNS servers did not answer in time",
  ESERVFAIL: "The domain's name servers returned an error (SERVFAIL)",
  EREFUSED: "The DNS query was refused",
  ECONNREFUSED: "Could not reach the DNS servers",
};

export async function checkDns(config: DnsConfig): Promise<CheckResult> {
  const host = config.host.toLowerCase().replace(/\.$/, "");
  if (!host) return fail("No host configured");
  if (net.isIP(host)) return fail("DNS monitors need a hostname, not an IP address");
  const resolver = new Resolver({ timeout: 2_500, tries: 2 });
  resolver.setServers(PUBLIC_RESOLVERS);
  const start = process.hrtime.bigint();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const answers = await Promise.race([
      RESOLVE[config.recordType](resolver, host),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), BUDGET_MS);
      }),
    ]);
    const responseMs = elapsed(start);
    if (!answers.length) return fail(`No ${config.recordType} records found`, { responseMs });
    if (config.expected) {
      const expected = config.expected.toLowerCase().replace(/\.$/, "");
      const match = answers.some((a) => a.toLowerCase().replace(/\.$/, "").includes(expected));
      if (!match) {
        const got = answers.slice(0, 3).join(", ");
        return fail(`Expected a ${config.recordType} record containing '${config.expected}', got ${got.slice(0, 200)}`, { responseMs });
      }
    }
    return { ok: true, statusCode: null, responseMs, error: null };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "";
    if (code === "ENODATA") return fail(`No ${config.recordType} records found`, { responseMs: elapsed(start) });
    return fail(ERRORS[code] ?? `DNS lookup failed (${code || "unknown error"})`, { responseMs: elapsed(start) });
  } finally {
    clearTimeout(timer);
    resolver.cancel();
  }
}
