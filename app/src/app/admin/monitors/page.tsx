import Link from "next/link";
import { Search } from "lucide-react";
import { Card, EmptyState, PageHeader, Pagination, Table, Td, Th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/db";
import { cn, formatDate } from "@/lib/utils";
import { isMonitorType, monitorTarget, parseJson } from "@/monitor/normalize";

export const metadata = { title: "Monitors" };

const PER_PAGE = 25;
const FILTERS = [
  { value: "all", label: "All" },
  { value: "down", label: "Down" },
  { value: "up", label: "Up" },
  { value: "paused", label: "Paused" },
] as const;

const TYPE_LABELS: Record<string, string> = {
  http: "HTTP",
  keyword: "Keyword",
  tcp: "TCP port",
  ssl: "SSL",
  domain: "Domain",
  dns: "DNS",
  heartbeat: "Heartbeat",
};

const STATUS_TONES = { up: "success", down: "danger", pending: "neutral", paused: "neutral", maintenance: "primary" } as const;

export default async function AdminMonitorsPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const filter = FILTERS.some((f) => f.value === params.filter) ? params.filter! : "all";
  const page = Math.max(1, Number(params.page) || 1);
  const db = await getDb();

  let query = db.selectFrom("monitors").innerJoin("users", "users.id", "monitors.user_id");
  if (q) {
    const like = `%${q}%`;
    query = query.where((eb) =>
      eb.or([eb("monitors.name", "like", like), eb("monitors.config", "like", like), eb("users.email", "like", like), eb("users.name", "like", like)]),
    );
  }
  if (filter === "down") query = query.where("monitors.status", "=", "down").where("monitors.is_active", "=", 1);
  if (filter === "up") query = query.where("monitors.status", "=", "up").where("monitors.is_active", "=", 1);
  if (filter === "paused") query = query.where("monitors.is_active", "=", 0);

  const [total, rows, counts] = await Promise.all([
    query.select((eb) => eb.fn.countAll<number>().as("n")).executeTakeFirst(),
    query
      .select([
        "monitors.id",
        "monitors.name",
        "monitors.type",
        "monitors.config",
        "monitors.status",
        "monitors.is_active",
        "monitors.interval_sec",
        "monitors.last_check_at",
        "monitors.last_error",
        "users.id as user_id",
        "users.name as user_name",
        "users.email as user_email",
      ])
      .orderBy("monitors.id", "desc")
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE)
      .execute(),
    db
      .selectFrom("monitors")
      .select(["status", "is_active", (eb) => eb.fn.countAll<number>().as("n")])
      .groupBy(["status", "is_active"])
      .execute(),
  ]);

  const ids = rows.map((r) => r.id);
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const uptimeRows = ids.length
    ? await db
        .selectFrom("checks")
        .select(["monitor_id", (eb) => eb.fn.countAll<number>().as("total"), (eb) => eb.fn.sum<number>("ok").as("good")])
        .where("monitor_id", "in", ids)
        .where("checked_at", ">=", since)
        .groupBy("monitor_id")
        .execute()
    : [];
  const uptime = new Map(uptimeRows.map((r) => [r.monitor_id, Number(r.total) ? (Number(r.good) / Number(r.total)) * 100 : null]));

  let active = 0;
  let down = 0;
  let all = 0;
  for (const c of counts) {
    all += Number(c.n);
    if (c.is_active) active += Number(c.n);
    if (c.is_active && c.status === "down") down += Number(c.n);
  }

  const pages = Math.max(1, Math.ceil(Number(total?.n ?? 0) / PER_PAGE));
  const href = (p: number) => `/admin/monitors?${new URLSearchParams({ ...(q ? { q } : {}), filter, page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Monitors"
        description={`${all.toLocaleString()} monitors · ${active.toLocaleString()} active · ${down.toLocaleString()} down`}
      />
      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <form className="relative w-full sm:max-w-xs" action="/admin/monitors">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input type="hidden" name="filter" value={filter} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name, URL or owner"
              aria-label="Search monitors"
              className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm focus:border-primary focus:outline-none"
            />
          </form>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <Link
                key={f.value}
                href={`/admin/monitors?${new URLSearchParams({ ...(q ? { q } : {}), filter: f.value })}`}
                className={cn("rounded-md px-3 py-1.5 text-sm font-medium", filter === f.value ? "bg-primary-soft text-primary" : "text-muted hover:text-ink")}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>
        {rows.length ? (
          <Table minWidth={900}>
            <thead>
              <tr>
                <Th>Monitor</Th>
                <Th>Owner</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Last check</Th>
                <Th className="text-right">Uptime 24 h</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const target = isMonitorType(m.type) ? monitorTarget(m.type, parseJson(m.config)) : "";
                const status = m.is_active ? m.status : "paused";
                const up = uptime.get(m.id);
                return (
                  <tr key={m.id}>
                    <Td className="max-w-80">
                      <p className="truncate font-medium">{m.name}</p>
                      <p className="truncate font-mono text-xs text-muted" dir="ltr" title={target}>
                        {target}
                      </p>
                    </Td>
                    <Td>
                      <Link href={`/admin/users/${m.user_id}`} className="font-medium hover:text-primary">
                        {m.user_name}
                      </Link>
                      <p className="text-xs text-muted">{m.user_email}</p>
                    </Td>
                    <Td className="text-muted">{TYPE_LABELS[m.type] ?? m.type}</Td>
                    <Td>
                      <Badge tone={STATUS_TONES[status] ?? "neutral"} className="capitalize">
                        {status}
                      </Badge>
                      {status === "down" && m.last_error ? (
                        <p className="mt-1 max-w-56 truncate text-xs text-red-700 dark:text-red-300" title={m.last_error}>
                          {m.last_error}
                        </p>
                      ) : null}
                    </Td>
                    <Td className="text-muted">{m.last_check_at ? formatDate(m.last_check_at, true) : "—"}</Td>
                    <Td className="text-right tabular-nums">{up == null ? <span className="text-muted">—</span> : `${up >= 99.995 ? "100" : up.toFixed(2)}%`}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No monitors found">{q || filter !== "all" ? "Try a different search or filter." : "Monitors your users create appear here."}</EmptyState>
        )}
        <Pagination page={page} pages={pages} href={href} />
      </Card>
    </>
  );
}
