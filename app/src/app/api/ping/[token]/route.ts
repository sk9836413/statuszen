import type { NextRequest } from "next/server";
import { respondToPing } from "@/lib/heartbeat";

/**
 * Heartbeat (cron job) ping URL. No authentication: the token is the secret.
 *   GET|POST|HEAD /api/ping/{token}               job finished OK
 *   GET|POST|HEAD /api/ping/{token}/start         job started
 *   GET|POST|HEAD /api/ping/{token}/fail          job failed
 *   ?state=start|fail works too, ?ms=1234 reports the runtime.
 * Always answers plain text ("OK"), so `curl -fsS` in a crontab stays quiet.
 */

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

const handler = (head: boolean) => async (request: NextRequest, { params }: Ctx) => {
  const { token } = await params;
  return respondToPing(request, token, request.nextUrl.searchParams.get("state"), head);
};

export const GET = handler(false);
export const POST = handler(false);
export const HEAD = handler(true);
