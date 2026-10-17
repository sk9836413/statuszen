import { getCurrentUser } from "@/lib/auth/session";
import { getSubscribers } from "@/lib/dashboard-data";
import { getOwnedStatusPage } from "@/lib/status-pages";

export const dynamic = "force-dynamic";

/** Quote a CSV cell; neutralise spreadsheet formulas. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV export of a status page's subscribers (owner only). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") return new Response("Unauthorized", { status: 401 });
  const page = await getOwnedStatusPage(Number((await params).id), user.id);
  if (!page) return new Response("Not found", { status: 404 });
  const rows = await getSubscribers(page.id, 100_000);
  const lines = [
    ["email", "confirmed_at", "subscribed_at"].join(","),
    ...rows.map((r) => [cell(r.email), cell(r.confirmed_at ?? ""), cell(r.created_at)].join(",")),
  ];
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${page.slug}-subscribers.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
