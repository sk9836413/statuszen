import "server-only";
import net from "node:net";
import type { CheckResult, TcpConfig } from "@/monitor/types";
import { PRIVATE_BLOCKED, blockedLiteral, blockedName, elapsed, fail, lookupFor, networkErrorText, type CheckOptions } from "./util";

export function checkTcp(config: TcpConfig, opts: CheckOptions): Promise<CheckResult> {
  const timeoutSec = config.timeoutSec || 10;
  if (!config.host) return Promise.resolve(fail("No host configured"));
  if (blockedLiteral(config.host, opts.allowPrivate) || blockedName(config.host, opts.allowPrivate)) return Promise.resolve(fail(PRIVATE_BLOCKED));

  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    let settled = false;
    const socket = net.connect({ host: config.host.replace(/^\[|\]$/g, ""), port: config.port, lookup: lookupFor(opts.allowPrivate) });
    const finish = (result: CheckResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => finish(fail(`Timed out after ${timeoutSec} s`)), timeoutSec * 1000);
    socket.once("connect", () => finish({ ok: true, statusCode: null, responseMs: elapsed(start), error: null }));
    socket.once("error", (error) => finish(fail(networkErrorText(error, timeoutSec))));
  });
}
