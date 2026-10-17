#!/usr/bin/env node
/**
 * Statuszen check worker — runs due checks every 15 seconds.
 *
 *   CRON_SECRET=your-secret npm run worker
 *
 * It simply calls the app's cron URL (/api/cron/tick) in a loop, so the app
 * server must be running (npm start / node server.js / Docker).
 *
 * Environment:
 *   CRON_SECRET   required. Set the SAME value for the app server, or copy the
 *                 secret shown in Admin → System → Scheduler.
 *   WORKER_URL    base URL of the app (default: SITE_URL, else http://localhost:$PORT)
 *   PORT          app port when WORKER_URL/SITE_URL are not set (default 3000)
 *   WORKER_INTERVAL_SEC  seconds between ticks (default 15)
 *
 * Variables are also read from .env / .env.local in the current folder.
 * PM2: `pm2 start ecosystem.config.cjs` starts it as "statuszen-worker".
 */

for (const file of [".env", ".env.local", ".env.production"]) {
  try {
    process.loadEnvFile?.(file);
  } catch {
    // File missing: fine.
  }
}

const secret = (process.env.CRON_SECRET || "").trim();
const base = (process.env.WORKER_URL || process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, "");
const intervalMs = Math.max(5, Number(process.env.WORKER_INTERVAL_SEC) || 15) * 1000;

if (!secret) {
  console.error("[worker] CRON_SECRET is not set. Copy the secret from Admin → System → Scheduler, or set CRON_SECRET for both the app and the worker.");
  process.exit(1);
}

let stopping = false;
const stop = () => {
  stopping = true;
  console.log("[worker] stopping…");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const url = `${base}/api/cron/tick`;
console.log(`[worker] calling ${url} every ${intervalMs / 1000} s`);

let failures = 0;
while (!stopping) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "X-Statuszen-Worker": "1" },
      signal: AbortSignal.timeout(75_000),
    });
    const body = await res.text();
    if (res.status === 401) {
      console.error("[worker] 401: the secret doesn't match the app's CRON_SECRET / Admin → System → Scheduler.");
    } else if (!res.ok) {
      console.error(`[worker] HTTP ${res.status}: ${body.slice(0, 200)}`);
    } else {
      const s = JSON.parse(body);
      failures = 0;
      if (s.skippedLocked) console.log("[worker] another tick is running, skipped");
      else if (s.checked || s.down || s.recovered || s.alertsSent) {
        console.log(`[worker] checked ${s.checked}, down ${s.down}, recovered ${s.recovered}, alerts ${s.alertsSent} (${s.durationMs} ms)`);
      }
    }
  } catch (error) {
    failures += 1;
    // Quiet while the app is starting; then report every 20th failure.
    if (failures === 3 || failures % 20 === 0) console.error(`[worker] can't reach ${url}: ${error instanceof Error ? error.message : error}`);
  }
  const wait = intervalMs - (Date.now() - started);
  if (wait > 0 && !stopping) await sleep(wait);
}
process.exit(0);
