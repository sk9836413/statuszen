# Statuszen

Uptime monitoring, public status pages and cron job (heartbeat) monitoring as a service, built with
**Next.js 16**, **React 19** and **Tailwind CSS 4**. Customers add monitors (HTTP, keyword, TCP port,
SSL certificate, domain expiry via RDAP, DNS record, heartbeat), get alerts by email, signed webhook,
Slack, Discord, Microsoft Teams or Telegram, and publish branded status pages with uptime history,
incidents, maintenance windows, email subscribers (double opt-in), an Atom feed, SVG badges, a 2 KB
status widget (`sz.js`) and a public JSON API. Includes paid plans with limits, four payment
gateways, a blog, multi-language/RTL and a full admin panel.

The complete guide is in [`documentation/index.html`](../documentation/index.html) (open it in a browser).

## Quick start (local)

```bash
npm install
npm run dev
```

Open http://localhost:3000. You are redirected to the web installer at `/install`.
Choose **SQLite** for a zero-setup local database, or **MySQL** for production.
`npm run dev` also builds the status widget `public/sz.js` first.

Checks run in "lazy mode" by default (after page views, at most once a minute). To run them in the
background, start the worker in a second terminal with the secret from Admin → System → Scheduler:

```bash
CRON_SECRET=the-secret-from-admin npm run worker
```

Private and local addresses (localhost, 10.x, 192.168.x…) can't be monitored unless you enable
Admin → Settings → Monitoring → "Allow private network addresses".

## Production

```bash
npm install
npm run build        # builds public/sz.js (prebuild), then the Next.js app
npm start            # or: node server.js  (cPanel / Passenger / PM2)
```

Requirements: Node.js 20.9+ (22.13+ for the SQLite option), a MySQL 5.7+/MariaDB 10.3+ database or
the built-in SQLite option, HTTPS, and outbound internet access (HTTP(S), TCP ports being monitored,
DNS to 1.1.1.1/8.8.8.8, RDAP over HTTPS, SMTP).

### Running checks

Something must start a "tick" (run due checks). Pick one:

| Method | How | Notes |
| ------ | --- | ----- |
| Lazy mode | On by default (Settings → Monitoring) | Only while people use the site. Fine for testing. |
| Cron URL | `curl -fsS "https://your-site/api/cron/tick?key=SECRET"` every minute | cPanel, shared hosting, Vercel (external cron service). |
| Worker | `CRON_SECRET=… npm run worker` (calls the cron URL every 15 s) | VPS / Docker. Needed for 30-second intervals. |

The secret is `CRON_SECRET` (env) or a random value stored in the database and shown in
Admin → System → Scheduler, which also shows whether ticks are running and how many monitors are overdue.
The cron URL also accepts `Authorization: Bearer SECRET` (as sent by Vercel Cron).

- **PM2:** `ecosystem.config.cjs` starts the app (`statuszen`) and the worker (`statuszen-worker`).
- **Docker:** `docker-compose.yml` runs `app`, `worker` and MySQL 8.4.

> **Required:** set `CRON_SECRET` (12+ random characters, e.g. `openssl rand -hex 24`) before `pm2 start` or
> `docker compose up`. docker-compose refuses to start without it, and the app ignores short or example values.

## Project structure

```
src/
  app/(site)/              Public website: home, pricing, blog, pages, account, auth, checkout
  app/(dashboard)/         Customer dashboard: overview, monitors, incidents, maintenance,
                           status pages, alert channels
  app/admin/               Admin panel (incl. /admin/monitors and the System → Scheduler card)
  app/install/             Web installer
  app/actions/             Server actions (auth, billing, dashboard/*, status page subscriptions)
  app/api/cron/tick/       Cron URL: runs one scheduler tick (secret required)
  app/api/ping/[token]/    Heartbeat ping URLs (+ /start and /fail)
  app/api/status/[slug]/   Public status JSON (CORS, used by sz.js)
  app/api/payments/        Payment gateway callbacks
  app/badge/               SVG badges: /badge/{slug}.svg and /badge/m/{key}.svg
  app/s/[slug]/            Public status pages, history, incidents, confirm/unsubscribe, feed.xml
  monitor/types.ts         The contract: monitor/channel types, configs, alert payload, page settings
  monitor/normalize.ts     Defaults, validation and clamping of monitor/channel/page settings
  lib/checks/              Check engine: http (+keyword), tcp, ssl, domain (RDAP), dns, util
  lib/scheduler.ts         Ticks: lock, due monitors, concurrency, heartbeats, maintenance, cleanup
  lib/lazy-tick.ts         Lazy mode (tick after a response when none ran for a minute)
  lib/monitor-state.ts     After a check: confirmations, up/down, incidents, alerts, reminders
  lib/heartbeat.ts         Heartbeat ping handling
  lib/alerts/              Alert channels (email, webhook, slack, discord, teams, telegram),
                           alert texts and status page subscriber emails
  lib/net/ssrf.ts          Private-address rules and guarded DNS lookup
  lib/i18n/messages.ts     Every interface string in English (source for translations)
  lib/db/migrations.ts     Database schema and default plans (run automatically)
  status-widget/           Source of the status widget (bundled to public/sz.js)
  components/dashboard/    Dashboard UI: monitor form, channel forms, status page builder, charts
  components/status/       Public status page components
scripts/build-widget.mjs   Bundles src/status-widget into public/sz.js with esbuild (20 KB gzip budget)
scripts/worker.mjs         Check worker: calls /api/cron/tick every WORKER_INTERVAL_SEC (15 s)
storage/                   Created at runtime: config.json, SQLite database, uploads
```

`public/sz.js` is generated and not committed. It is rebuilt by `predev`, `prebuild` and
`npm run widget:build`.

## Scripts

| Command                | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `npm run dev`          | Build `sz.js`, then start the development server              |
| `npm run build`        | Build `sz.js`, then the production app                        |
| `npm start`            | Start the production server                                   |
| `npm run start:server` | Start via `server.js` (hosting panels, PM2)                   |
| `npm run worker`       | Run due checks every 15 s (needs `CRON_SECRET`)               |
| `npm run widget:build` | Rebuild only `public/sz.js` (prints raw and gzip size)        |
| `npm run lint`         | ESLint                                                        |
| `npm run typecheck`    | TypeScript check                                              |

## Adding a monitor type

1. `src/monitor/types.ts`: add to `MONITOR_TYPES`, a config interface and `ConfigByType`.
2. `src/monitor/normalize.ts`: `DEFAULTS`, a case in `normalizeConfig`, `monitorTarget`, `configProblem`.
3. `src/lib/checks/<type>.ts` returning a `CheckResult` (never throw; use the private-address guard
   from `util.ts`), wired in `runCheck()` and `checkTimeoutMs()` in `src/lib/checks/index.ts`.
4. Dashboard: fields in `components/dashboard/monitor-form.tsx`, icon in `monitor-meta.tsx`,
   `DEFAULT_INTERVAL` in `app/(dashboard)/dashboard/monitors/new/page.tsx`, rules in
   `app/actions/dashboard/helpers.ts`.
5. Messages: `dash.type.*`, `dash.typeDesc.*`, `dash.form.namePlaceholder.*` in `src/lib/i18n/messages.ts`.
6. `npm run typecheck && npm run build`.

Alert channels follow the same pattern: `CHANNEL_TYPES`/`ChannelConfigByType`,
`normalizeChannelConfig`/`channelProblem`, a sender in `src/lib/alerts/` using `describeAlert()` and
`deliver()`, a case in `sendAlert()`, and the form in `components/dashboard/channel-forms.tsx`.

## Environment variables

Optional; the web installer writes `storage/config.json`. See `.env.example` for database
variables, `ADMIN_*`, `SITE_URL`, `STORAGE_DIR`, `TRUSTED_PROXY_HOPS`, `CRON_SECRET`, `DEMO_MODE` and
`DEMO_SEED`. The worker also reads `WORKER_URL` and `WORKER_INTERVAL_SEC`.
