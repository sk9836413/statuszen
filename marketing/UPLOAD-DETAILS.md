# CodeCanyon upload – Statuszen 1.0.0

Copy each section into the matching field of the upload form
(Author Dashboard → Upload → CodeCanyon).

Demo details are filled in: https://statuszen.vercel.app, login demo@statuszen.app / demo12345 (read-only; lands in the admin panel, the "My monitors (customer dashboard)" link in the admin sidebar opens the customer dashboard).

---

## 1. Name (max 100 characters, no "|")

```
Statuszen - Uptime Monitoring, Status Pages & Cron Monitoring SaaS (Next.js)
```

(76 characters)

---

## 2. Category

**JavaScript → Miscellaneous**

Most Next.js SaaS items use this one. If the form doesn't offer it, choose **JavaScript**. The reviewer can still move the item to another category.

---

## 3. Files to upload

| Field | File | Notes |
|---|---|---|
| Thumbnail (80×80) | `marketing/final/thumbnail-80x80.png` | 2 KB (limit 50 KB), the brand mark |
| Inline preview (590×300) | `marketing/final/preview-590x300.jpg` | 53 KB |
| Main files (ZIP) | `dist/Statuszen-1.0.0.zip` | Source code and documentation. **Rebuild it first** (see the checklist) |
| Screenshots (ZIP) | `marketing/final/Statuszen-Screenshots.zip` | 36 JPG images at the zip root (4.3 MB), made with PowerShell `Compress-Archive` |

Upload these files to the Envato FTP or the upload box first, then pick them in the form.

The single images are also in `marketing/final/screenshots/` if you want to host them for the description.
Regenerate everything with `node shoot.mjs`, `node render.mjs` and `python finalize.py` (in `marketing/`; the full recipe, including the optional sample data of `demo-extras.py`, is at the top of `shoot.mjs`).

---

## 4. Live preview URL

```
https://statuszen.vercel.app
```

Demo login (also written in the description):
`demo@statuszen.app` / `demo12345`

The login opens the **admin panel**. The customer dashboard (monitors, incidents, status pages, alert channels, maintenance) is one click away: **"My monitors (customer dashboard)"** in the admin sidebar. The public status page of the demo is linked from the home page.

Run the demo with `DEMO_MODE=true` (read-only) and `DEMO_SEED=true` (8 sample monitors with 90 days of history, incidents, a planned maintenance, the status page `/s/demo`, 45 sample customers, Arabic and Hindi packs), and set `ADMIN_EMAIL` / `ADMIN_PASSWORD` to the demo login so the sign-in page pre-fills it. On Vercel, an external cron service must open the cron URL every minute, otherwise checks only run on visits (lazy mode).

---

## 5. Attributes (hold CTRL to select several)

| Field | Value |
|---|---|
| High Resolution | Yes |
| Compatible Browsers | Firefox, Safari, Opera, Chrome, Edge (no IE) |
| Files Included | JavaScript JS, JavaScript JSON, HTML, CSS |
| Software Version | ReactJS, Node.js |
| Demo URL | https://statuszen.vercel.app |
| Video Preview Resolution | leave empty |

---

## 6. Tags (max 15, one per box)

```
uptime monitoring, status page, website monitor, cron monitoring, heartbeat, ssl monitor, domain expiry, incident management, downtime alert, server monitoring, api monitoring, slack alerts, telegram alerts, nextjs, saas
```

---

## 7. Price (you set it; the item price already includes your author fee, the buyer fee is added on top)

- **Regular License item price:** $49
- **Extended License item price:** $299

The form's "recommended" range is a generic guide for small scripts. Statuszen is a complete SaaS: 7 monitor types, a check engine with SSRF protection, three schedulers, 6 alert channels, incidents, maintenance windows, public status pages with subscribers, badges, a status widget, a JSON API, billing with four gateways and an admin panel. Self-hosted uptime/status page scripts sell at $29–$79, and the hosted services it replaces cost their users $10–$100 every month.

Why the Extended License matters: Statuszen is built to charge customers for plans. Under Envato's licences, an end product that end users pay for needs the **Extended License**. The description says this clearly, so buyers pick the right licence and don't ask for refunds later.

---

## 8. Description (paste in the HTML / description editor)

Only Envato-safe tags are used: h2, h3, p, ul, li, strong, a, br.

```html
<h2>Statuszen – Launch your own uptime monitoring and status page SaaS</h2>

<p><strong>Statuszen</strong> is a complete, ready-to-run uptime monitoring platform built with <strong>Next.js 16, React 19 and Tailwind CSS 4</strong>. Your customers sign up and monitor their websites, APIs, SSL certificates, domains, DNS records and <strong>cron jobs</strong>. When something goes down they are alerted by <strong>email, Slack, Discord, Microsoft Teams, Telegram or a signed webhook</strong>, an incident opens automatically and their <strong>public status page</strong> keeps visitors informed. You charge them for plans with Stripe, PayPal, Razorpay or bank transfer.</p>

<p>It works on a normal Node.js host without any extra service: checks run from your own server, with a cron URL, a 15-second worker or even without cron at all (lazy mode).</p>

<h3>Live demo</h3>
<p>Website: <a href="https://statuszen.vercel.app">https://statuszen.vercel.app</a><br>
Sign in with <strong>demo@statuszen.app</strong> / <strong>demo12345</strong> (read-only demo, saving is disabled).<br>
You land in the admin panel. Click <strong>"My monitors (customer dashboard)"</strong> in the admin sidebar to open the customer dashboard with sample monitors, incidents, status pages and alert channels.<br>
The sample status page is linked from the home page.</p>

<h3>7 monitor types</h3>
<ul>
  <li><strong>Website (HTTP)</strong> – any method, custom headers and body, accepted status codes, timeout, redirects, maximum response time, basic auth</li>
  <li><strong>Keyword</strong> – alert when a word is missing from a page (or when it appears)</li>
  <li><strong>TCP port</strong> – databases, mail servers, SSH and any other service that listens on a port</li>
  <li><strong>SSL certificate</strong> – expired, invalid or untrusted certificates, with warnings days before expiry</li>
  <li><strong>Domain expiry</strong> – registration dates from RDAP, the modern successor of WHOIS</li>
  <li><strong>DNS record</strong> – A, AAAA, CNAME, MX, TXT and NS records, optionally with an expected value</li>
  <li><strong>Cron / heartbeat</strong> – the job pings a secret URL; a missed ping is an alert</li>
</ul>

<h3>Checks you can trust</h3>
<ul>
  <li>Check every 30 seconds up to every 24 hours (limited by the customer's plan)</li>
  <li><strong>1–5 confirmations</strong> before an alert, with a quick recheck after a failure: no false alarms from a single network blip</li>
  <li><strong>Test now</strong> in the monitor form tries the settings before saving; <strong>Check now</strong> runs a real check on demand</li>
  <li>Uptime for 24 hours, 7, 30 and 90 days, response-time charts, 90 daily uptime bars, recent checks and an alert log per monitor</li>
  <li>SSRF protection for every check and webhook: customers can't use your server to reach private networks</li>
</ul>

<h3>Cron job (heartbeat) monitoring</h3>
<ul>
  <li>A secret ping URL per job, with <strong>/start</strong> to measure the run time and <strong>/fail</strong> to report a failure right away</li>
  <li>Grace periods from 1 minute to 1 day, a job run-time chart and a list of recent pings</li>
  <li>Copy-paste snippets for crontab, Bash, PowerShell, Node.js, Python and GitHub Actions (plus systemd and Laravel in the documentation)</li>
</ul>

<h3>6 alert channels</h3>
<ul>
  <li><strong>Email</strong> (up to 10 addresses), <strong>Slack</strong>, <strong>Discord</strong>, <strong>Microsoft Teams</strong> (Workflows), <strong>Telegram</strong> and <strong>webhooks</strong> signed with HMAC-SHA256 (Zapier, Make, n8n or your own code)</li>
  <li>Down, recovery (with the downtime), hourly "still down" reminders, SSL and domain expiry warnings</li>
  <li>Send a test with one click; the exact error is shown when a delivery fails</li>
</ul>

<h3>Incidents and maintenance</h3>
<ul>
  <li>Incidents open when a monitor is confirmed down and resolve when it recovers</li>
  <li>Post updates (Investigating, Identified, Monitoring, Resolved) and report <strong>manual incidents</strong> with an impact level</li>
  <li><strong>Maintenance windows</strong>: shown on status pages as upcoming and in progress, alerts are muted and the downtime doesn't count</li>
</ul>

<h3>Public status pages</h3>
<ul>
  <li>Logo, light or dark theme, accent colour, component groups and display names</li>
  <li>30, 60 or 90 days of uptime bars, uptime percentages and response-time charts</li>
  <li>Open incidents with their updates, upcoming maintenance, past incidents, a history by month and a page per incident</li>
  <li><strong>Email subscribers</strong> with double opt-in and one-click unsubscribe, CSV export, and an <strong>Atom feed</strong></li>
  <li>Announcement banner, "hide from search engines" and a private preview mode</li>
</ul>

<h3>Badges, status widget and JSON API</h3>
<ul>
  <li><strong>SVG badges</strong> for the status of a page, the status of a monitor or its 30-day uptime (flat or flat-square, custom label)</li>
  <li><strong>sz.js</strong>: a 2 KB status widget for any website with an incident banner, drawn in a Shadow DOM</li>
  <li>A public, read-only <strong>JSON API</strong> per status page with CORS</li>
</ul>

<h3>Three ways to run checks</h3>
<ul>
  <li><strong>Lazy mode</strong> (on by default): checks run while people use the site, so it works right after installing, with no cron job</li>
  <li><strong>Cron URL</strong>: open one URL every minute from cPanel, crontab or any online cron service</li>
  <li><strong>Worker</strong>: a tiny Node.js process that checks every 15 seconds (PM2 and Docker configurations included)</li>
  <li>Admin → System shows the scheduler's health, the last result and overdue monitors</li>
</ul>

<h3>Make money with plans</h3>
<ul>
  <li>Unlimited plans with <strong>monitor and status page limits</strong>, the <strong>fastest check interval</strong> and "Powered by" branding removal. Monthly and yearly prices</li>
  <li>Three plans are created for you: <strong>Free</strong> (5 monitors, every 5 minutes, 1 status page), <strong>Pro</strong> (15 a month or 150 a year: 50 monitors, every minute, 5 status pages) and <strong>Agency</strong> (39 a month or 390 a year: 500 monitors, every 30 seconds, 50 status pages). Change them any time</li>
  <li><strong>4 payment methods</strong>: Stripe (subscriptions with automatic renewal, Apple Pay, Google Pay), PayPal, Razorpay (UPI, cards, netbanking) and bank transfer with manual approval</li>
  <li>Free status pages show your "Powered by" link: free advertising for your platform</li>
</ul>

<h3>Admin panel</h3>
<ul>
  <li>Dashboard with users, active plans, revenue, checks per day, monitors that are down and the latest payments</li>
  <li>Users (give a plan until a date, ban, change role), all monitors of the platform, plans, payments with bank transfer approval</li>
  <li>Content pages, a blog with three starter articles, contact messages, languages and the translation editor</li>
  <li>Settings: branding (logo, favicon, colour), SEO, monitoring (scheduler, data retention, status page branding), payments, SMTP email, registration, maintenance mode</li>
  <li>System: scheduler health, "Run checks now", cron URL and secret, server information and an email test</li>
</ul>

<h3>Multi-language and RTL</h3>
<ul>
  <li>Translate the public site, the status pages and the customer dashboard in the admin panel</li>
  <li>Right-to-left layouts for Arabic, Hebrew, Persian and Urdu</li>
  <li><strong>Arabic and Hindi language packs included</strong>. JSON import and export</li>
</ul>

<h3>Easy to install</h3>
<ul>
  <li><strong>Web installer</strong>: choose MySQL/MariaDB or zero-setup SQLite and create the admin account in a few clicks</li>
  <li>Step-by-step guides for cPanel ("Setup Node.js App"), VPS with PM2 and Nginx, Docker and Vercel</li>
  <li>Database updates are applied automatically when you update. Ping URLs, badges and widget snippets keep working</li>
  <li>Detailed documentation with a customer guide you can reuse for your help pages</li>
</ul>

<h3>Security</h3>
<ul>
  <li>SSRF protection after DNS resolution and on every redirect, for checks and webhooks</li>
  <li>scrypt password hashing, HTTP-only sessions, rate limits, constant-time secret comparison</li>
  <li>No external CDNs: fonts and scripts are bundled</li>
</ul>

<h3>Requirements</h3>
<ul>
  <li>Node.js 20.9 or newer (22 LTS recommended; 22.13+ for the SQLite option)</li>
  <li>MySQL 5.7+ / MariaDB 10.3+, or the built-in SQLite option</li>
  <li>Hosting that runs Node.js apps (VPS, cPanel with Node.js, Plesk, Docker, Railway, Render, Vercel…) and HTTPS. A VPS is recommended for monitoring. Plain PHP-only shared hosting is not supported</li>
  <li>Checks run from your server, from one location (no network of probe servers)</li>
</ul>

<h3>Licence note</h3>
<p>Statuszen lets you charge your customers for plans. If your platform charges end users, you need the <strong>Extended License</strong>. The Regular License covers a single free platform, for example to monitor your own or your clients' websites without paid plans.</p>

<h3>Changelog</h3>
<p><strong>Version 1.0.0 (17 October 2026)</strong></p>
<ul>
  <li>Initial release</li>
</ul>

<h3>Support</h3>
<p>Questions, installation help or bug reports: use the <strong>Support</strong> tab on this page. Please include your hosting type, Node.js version, how you run checks (lazy, cron or worker) and any error message from the monitor page, the logs or the browser console.</p>
```

---

## 9. Message to the reviewer

```
Hi, Statuszen is a Next.js 16 / React 19 application (Node.js runtime, no PHP).
It is an uptime monitoring platform: customers add monitors (HTTP, keyword, TCP,
SSL, domain, DNS, cron heartbeats), get alerts (email, Slack, Discord, Teams,
Telegram, webhook) and publish status pages. The platform owner sells plans
(Stripe, PayPal, Razorpay, bank transfer).

- Live demo: https://statuszen.vercel.app
- Login: demo@statuszen.app / demo12345 (demo mode, saving is disabled)
- The login opens the admin panel. "My monitors (customer dashboard)" in the admin
  sidebar opens the customer dashboard with sample monitors and incidents.
- Public status page of the demo: linked from the home page.
- Arabic RTL and Hindi: use the language switcher in the header.

All checks run from the buyer's own server; private and local addresses are
blocked (SSRF protection). Checks are started by a cron URL, a worker process or,
by default, lazy mode (no cron needed).

Installation: unzip, run "npm install && npm run build && npm start", then open the
site and follow the web installer (SQLite needs no database server). The full guide
is in documentation/index.html.

All third-party libraries are open source with licences that allow commercial use
(listed in the documentation's Credits section). Fonts are bundled under the SIL OFL.

Thank you for reviewing.
```

---

## 10. Checklist before you press Submit

- [ ] The Envato author account is complete (profile, payout method, tax form).
- [x] Demo URL and login are filled in above.
- [ ] The live demo opens over HTTPS, the demo login works (DEMO_MODE=true) and the sample monitors show recent checks: set up an external cron service (e.g. cron-job.org) to open the demo's cron URL every minute, and ping or pause the sample "Nightly backup" heartbeat so the demo status page stays green.
- [ ] Item support: set to **Supported** (Author Dashboard → item settings → Support), with your support email or URL. The description points buyers to the Support tab.
- [ ] Choose "exclusive author" if you sell it only on Envato (higher share).
- [ ] Upload the screenshots zip made by `finalize.py` (PowerShell `Compress-Archive`, files at the zip root). Don't re-zip it with another tool.
- [ ] **Rebuild `dist/Statuszen-1.0.0.zip`** with `python scripts/package.py`: the current zip (17 Oct, 13:34) was made before the Arabic/Hindi packs were added in `statuszen/languages/`. Check that the new zip contains `Statuszen-1.0.0/documentation/` and `Statuszen-1.0.0/statuszen/` with `languages/ar.json` and `languages/hi.json` (no `storage/`, `.next/`, `node_modules/` or `public/sz.js`).
- [ ] Documentation, Languages & RTL: it still says "Version 1.0 does not include ready-made language packs". Update it to explain the bundled packs (Admin → Languages → add Arabic/Hindi → Import `languages/ar.json` / `hi.json`), since the description promises them.
- [ ] Arabic and Hindi packs reviewed by a native speaker if possible.
- [ ] Optional: fix the issues found while taking the screenshots (see the marketing report), rebuild, then run `node shoot.mjs`, `node render.mjs` and `python finalize.py` again.

Review usually takes a few days to a couple of weeks. "Soft rejection" requests are normal: fix them and resubmit.

### Note on the screenshots

The demo runs on localhost, so before each capture `shoot.mjs` swaps the local addresses in the visible text for public-looking ones: `http://localhost:3700` → `https://status.example.com` and the sample monitors' `example.com` → `northwind.io`. On Admin → System the cron secret and the storage folder are replaced with neutral values. Nothing is saved in the app.

For richer pictures, `demo-extras.py apply` added sample data to the local demo database while shooting (Slack/Telegram/Discord/Teams/webhook channels with fake URLs, an alert log, two weeks of heartbeat pings, a second upcoming and one completed maintenance window, nine customer monitors for Admin → Monitors, the admin renamed "Alex Morgan", and the Identified/Monitoring updates of the "Pricing page is down" incident). `demo-extras.py restore` removed all of it afterwards. On the Telegram channel page, a CSS line wraps the long getUpdates URL that overflows its help box (an app bug, see the report).
