# Statuszen

Social proof, testimonial and conversion widgets as a service, built with **Next.js 16**, **React 19**
and **Tailwind CSS 4**. Customers add their websites, paste one script tag and show 10 kinds of
widgets (recent activity, live visitors, conversion counter, reviews, announcement bar, coupon,
countdown, email collector, cookie notice, custom HTML) fed by real data: form capture, incoming
webhooks (Stripe, WooCommerce, Shopify, Zapier, Make, JSON), CSV import and manual events. Includes
testimonial collection and wall, leads, analytics, outgoing signed webhooks, paid plans with limits,
four payment gateways, a blog, multi-language/RTL and a full admin panel.

The complete guide is in `documentation/index.html` (included in the download package).

## Quick start (local)

```bash
npm install
npm run dev
```

Open http://localhost:3000. You are redirected to the web installer at `/install`.
Choose **SQLite** for a zero-setup local database, or **MySQL** for production.
`npm run dev` also builds the embed script `public/w.js` first.

To try widgets locally, add a website with the domain `localhost` in the dashboard (`/dashboard`)
and paste its snippet into any page served from `http://localhost`.

## Production

```bash
npm install
npm run build        # builds public/w.js (prebuild), then the Next.js app
npm start            # or: node server.js  (cPanel / Passenger / PM2)
```

Requirements: Node.js 20.9+ (22.13+ for the SQLite option), a MySQL 5.7+/MariaDB 10.3+ database or
the built-in SQLite option, and HTTPS (customers embed `https://your-domain/w.js`). See the
documentation for cPanel, VPS (PM2 + Nginx), Docker and Vercel guides.

## Project structure

```
src/
  app/(site)/            Public website: home, pricing, blog, pages, account, auth, checkout
  app/(dashboard)/       Customer dashboard: websites, widgets, events, testimonials, leads,
                         integrations, analytics, settings
  app/admin/             Admin panel
  app/install/           Web installer
  app/actions/           Server actions (auth, billing, dashboard, testimonial form)
  app/api/w/[key]/       Public widget API: config, track, presence, capture, lead
  app/api/hooks/[token]/ Incoming webhooks (Stripe, WooCommerce, Shopify, generic JSON)
  app/api/payments/      Payment gateway callbacks
  app/t/[key]/           Testimonial collection page
  app/embed/wall/[key]/  Embeddable testimonial wall (iframe, posts its height)
  app/widget-preview/    Page loaded by the widget editor's live preview
  widget/types.ts        Widget contract shared by w.js, the API and the editor
  widget/normalize.ts    Validation and clamping of saved widget settings
  widget/runtime/        Embed script source (bundled to public/w.js)
  components/dashboard/  Dashboard UI and the widget editor (widget-editor/)
  lib/                   Server code: database, settings, plans, sites, events, embed config,
                         usage, auth, payments, mail, notifications (outgoing webhooks)
  lib/webhooks/          Incoming webhook presets and sample payloads
  lib/i18n/messages.ts   Every interface string in English (source for translations)
  lib/db/migrations.ts   Database schema and default plans (run automatically)
scripts/build-widget.mjs Bundles src/widget/runtime into public/w.js with esbuild (20 KB gzip budget)
storage/                 Created at runtime: config.json, SQLite database, uploads
```

`public/w.js` is generated and not committed. It is rebuilt by `predev`, `prebuild` and
`npm run widget:build`.

## Scripts

| Command                | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `npm run dev`          | Build `w.js`, then start the development server               |
| `npm run build`        | Build `w.js`, then the production app                         |
| `npm start`            | Start the production server                                   |
| `npm run start:server` | Start via `server.js` (hosting panels, PM2)                    |
| `npm run widget:build` | Rebuild only `public/w.js` (prints raw and gzip size)          |
| `npm run lint`         | ESLint                                                        |
| `npm run typecheck`    | TypeScript check                                              |

## Adding a widget type

1. `src/widget/types.ts`: add to `WIDGET_TYPES`, `ContentByType` and `WIDGET_DEFAULTS`
   (and `ROTATING_TYPES` if it rotates items).
2. `src/widget/normalize.ts`: validate its content.
3. Runtime: a renderer in `src/widget/runtime/render.ts`, wired in `start()` in `run.ts`;
   server data in `buildWidgetData()` (`src/lib/embed.ts`) if needed; styles in `widget.css`.
4. Editor: fields in `components/dashboard/widget-editor/content-fields.tsx`, metadata in
   `type-meta.ts` and `components/dashboard/widget-types.tsx`, a mockup in `type-mockup.tsx`,
   sample data in `preview-data.ts`.
5. Messages: `dash.type.*`, `dash.typeDesc.*` and new `editor.*` keys in `src/lib/i18n/messages.ts`.
6. `npm run typecheck && npm run build`.

## Environment variables

Optional; the web installer writes `storage/config.json`. See `.env.example` for database
variables, `ADMIN_*`, `SITE_URL`, `STORAGE_DIR`, `TRUSTED_PROXY_HOPS`, `DEMO_MODE` and `DEMO_SEED`.
