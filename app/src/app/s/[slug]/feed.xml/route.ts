import { baseUrl } from "@/lib/request";
import { getIncidentsBetween, getPageMonitors, getPublicStatusPage, translatorFor } from "@/lib/status-view";

/** Atom feed of a public status page's incidents and maintenance, with every update. */

const xml = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublicStatusPage(slug);
  if (!page) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  const lang = new URL(request.url).searchParams.get("lang");
  const [{ t, code }, base, monitors] = await Promise.all([translatorFor(lang), baseUrl(), getPageMonitors(page)]);
  const ids = monitors.map((m) => m.monitor.id);
  const incidents = await getIncidentsBetween(page, ids, "1970-01-01T00:00:00.000Z", new Date(Date.now() + 60_000).toISOString(), 50);
  const names = new Map(monitors.map((m) => [m.monitor.id, m.name]));
  const pageUrl = `${base}/s/${page.slug}`;
  const updatedOf = (i: (typeof incidents)[number]) => [i.startedAt, i.resolvedAt ?? "", ...i.updates.map((u) => u.createdAt)].sort().pop()!;
  const feedUpdated = incidents.map(updatedOf).sort().pop() ?? page.updatedAt;
  const title = t("status.metaTitle", { name: page.name });

  const entries = incidents.map((i) => {
    const affected = i.monitorIds.map((id) => names.get(id)).filter(Boolean).join(", ");
    const html =
      i.updates
        .map((u) => `<p><strong>${xml(t(`status.incident.${u.status}`))}</strong> (${xml(new Date(u.createdAt).toUTCString())}) — ${xml(u.message).replace(/\n/g, "<br>")}</p>`)
        .join("") + (affected ? `<p>${xml(t("status.affects", { list: affected }))}</p>` : "");
    const url = `${pageUrl}/incidents/${i.id}`;
    return `  <entry>
    <id>${xml(url)}</id>
    <title>${xml(`[${t(`status.incident.${i.status}`)}] ${i.title}`)}</title>
    <link rel="alternate" type="text/html" href="${xml(url)}"/>
    <published>${xml(i.scheduledStart ?? i.startedAt)}</published>
    <updated>${xml(updatedOf(i))}</updated>
    <category term="${xml(i.kind === "maintenance" ? "maintenance" : i.impact)}"/>
    <content type="html">${xml(html || `<p>${xml(i.title)}</p>`)}</content>
  </entry>`;
  });

  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${xml(code)}">
  <id>${xml(pageUrl)}</id>
  <title>${xml(title)}</title>
  <subtitle>${xml(page.description || t("status.metaDescription", { name: page.name }))}</subtitle>
  <link rel="alternate" type="text/html" href="${xml(pageUrl)}"/>
  <link rel="self" type="application/atom+xml" href="${xml(`${pageUrl}/feed.xml`)}"/>
  <updated>${xml(feedUpdated)}</updated>
  <author><name>${xml(page.name)}</name></author>
${entries.join("\n")}
</feed>
`;
  return new Response(body, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8", "Cache-Control": "public, max-age=60" },
  });
}
