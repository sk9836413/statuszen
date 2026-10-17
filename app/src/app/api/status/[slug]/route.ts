import { maybeLazyTick } from "@/lib/lazy-tick";
import { baseUrl } from "@/lib/request";
import { buildPublicStatus, getPublicStatusPage, translatorFor } from "@/lib/status-view";

/**
 * GET /api/status/{slug} → PublicStatus JSON (see src/monitor/types.ts).
 * Open to any origin so the sz.js widget and customers' own scripts can read it.
 * `?lang=de` localises the headline (default: the site's default language).
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublicStatusPage(slug);
  if (!page) {
    return Response.json({ error: "Status page not found." }, { status: 404, headers: { ...CORS, "Cache-Control": "public, max-age=30" } });
  }
  maybeLazyTick();
  const lang = new URL(request.url).searchParams.get("lang");
  const [{ t }, base] = await Promise.all([translatorFor(lang), baseUrl()]);
  const body = await buildPublicStatus(page, t, base);
  return Response.json(body, {
    headers: { ...CORS, "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=30" },
  });
}
