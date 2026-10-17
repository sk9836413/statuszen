import type { ReactNode } from "react";
import { sql } from "kysely";
import { Card, PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { isDemoMode, storageDir } from "@/lib/config";
import { dbDriver, getDb } from "@/lib/db";
import { mailConfigured } from "@/lib/mail";
import { getCronSecret, cronSecretFromEnv, getSchedulerStatus } from "@/lib/scheduler";
import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/site";
import { formatDate } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";
import { CopyValue, RegenerateKeyForm, RunChecksForm } from "./scheduler-forms";
import { ClearCacheForm, PruneSessionsForm, TestEmailForm } from "./system-forms";

export const metadata = { title: "System" };

export default async function SystemPage() {
  const db = await getDb();
  const settings = await getSettings();
  const migrations = await sql<{ name: string; timestamp: string }>`select name, timestamp from kysely_migration order by name`
    .execute(db)
    .then((r) => r.rows)
    .catch(() => []);
  const driver = dbDriver();

  const info: Array<[string, ReactNode]> = [
    ["Application version", APP_VERSION],
    ["Node.js", process.versions.node],
    ["Database", driver === "mysql" ? "MySQL / MariaDB" : "SQLite"],
    ["Storage folder", <code key="s" className="font-mono text-xs">{storageDir()}</code>],
    ["Environment", process.env.NODE_ENV],
    ["Demo mode", isDemoMode() ? <Badge key="d" tone="warning">On</Badge> : "Off"],
    ["Email", mailConfigured(settings) ? <Badge key="e" tone="success">Configured</Badge> : <Badge key="e">Not configured</Badge>],
  ];

  const [scheduler, secret] = await Promise.all([getSchedulerStatus(), getCronSecret()]);
  const demo = isDemoMode();
  const cronUrl = absoluteUrl(settings, `/api/cron/tick?key=${demo ? "hidden-in-demo" : encodeURIComponent(secret)}`);
  const healthy = scheduler.healthy;
  const last = scheduler.lastSummary;

  return (
    <>
      <PageHeader title="System" description="Server information and maintenance tools." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Scheduler"
          className="xl:col-span-2"
          actions={healthy ? <Badge tone="success">Running</Badge> : <Badge tone="warning">{scheduler.lastTickAt ? "Stalled" : "Never ran"}</Badge>}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <dl className="divide-y divide-line text-sm">
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted">Last run</dt>
                  <dd className="text-right">
                    {scheduler.lastTickAt ? formatDate(scheduler.lastTickAt, true) : "Never"}
                    {scheduler.lastSource ? <span className="text-muted"> · {scheduler.lastSource}</span> : null}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted">Last result</dt>
                  <dd className="text-right">
                    {last
                      ? last.skippedLocked
                        ? "Skipped (another run was active)"
                        : `${last.checked} checked, ${last.down} down, ${last.recovered} recovered, ${last.alertsSent} alerts · ${(last.durationMs / 1000).toFixed(1)} s`
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted">Overdue monitors</dt>
                  <dd className="text-right">
                    {scheduler.overdue > 0 ? <Badge tone="warning">{scheduler.overdue}</Badge> : <Badge tone="success">0</Badge>}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted">Lazy mode (checks on page views)</dt>
                  <dd className="text-right">{settings.lazy_scheduler ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>}</dd>
                </div>
              </dl>
              <RunChecksForm />
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-2 font-medium">Cron URL</p>
                <CopyValue value={cronUrl} label="Cron URL" />
                <p className="mt-2 text-xs text-muted">
                  {cronSecretFromEnv()
                    ? "The secret comes from the CRON_SECRET environment variable."
                    : "Keep this URL private. The secret is stored in the database."}
                </p>
              </div>
              <div>
                <p className="font-medium">cPanel / Linux cron (every minute)</p>
                <code className="mt-1 block overflow-x-auto rounded-lg bg-paper p-3 font-mono text-xs whitespace-nowrap" dir="ltr">
                  {`*/1 * * * * curl -fsS "${cronUrl}" >/dev/null 2>&1`}
                </code>
              </div>
              <div>
                <p className="font-medium">VPS / Docker worker (every 15 seconds)</p>
                <p className="mt-1 text-muted">
                  Run <code className="font-mono text-xs">CRON_SECRET=… npm run worker</code> next to the app, or use the
                  <code className="font-mono text-xs"> statuszen-worker</code> process in <code className="font-mono text-xs">ecosystem.config.cjs</code> /
                  the <code className="font-mono text-xs">worker</code> service in <code className="font-mono text-xs">docker-compose.yml</code>.
                  30-second check intervals need the worker.
                </p>
              </div>
              <p className="text-muted">
                Without cron or the worker, lazy mode runs due checks at most once a minute while people use the site. Turn it on or off in
                Settings → Monitoring.
              </p>
              {!cronSecretFromEnv() && !demo ? <RegenerateKeyForm /> : null}
            </div>
          </div>
        </Card>
        <Card title="Server">
          <dl className="divide-y divide-line text-sm">
            {info.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="Database migrations">
          <p className="mb-3 text-sm text-muted">Migrations run automatically after an update. These have been applied:</p>
          <ul className="space-y-1.5 font-mono text-xs">
            {migrations.map((m) => (
              <li key={m.name} className="flex justify-between gap-3">
                <span>{m.name}</span>
                <span className="text-muted">{String(m.timestamp).slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Maintenance">
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-sm text-muted">Reload settings from the database if you edited them directly.</p>
              <ClearCacheForm />
            </div>
            <div className="border-t border-line pt-6">
              <p className="mb-3 text-sm text-muted">Delete expired sign-in sessions and password reset links.</p>
              <PruneSessionsForm />
            </div>
          </div>
        </Card>
        <Card title="Email test">
          <TestEmailForm defaultTo={settings.site_email} />
        </Card>
      </div>
    </>
  );
}
