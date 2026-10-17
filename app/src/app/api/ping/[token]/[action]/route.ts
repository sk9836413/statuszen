import type { NextRequest } from "next/server";
import { respondToPing } from "@/lib/heartbeat";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string; action: string }> };

const handler = (head: boolean) => async (request: NextRequest, { params }: Ctx) => {
  const { token, action } = await params;
  return respondToPing(request, token, action, head);
};

export const GET = handler(false);
export const POST = handler(false);
export const HEAD = handler(true);
