import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

import { PUBLIC_TAGS } from "../../public-cache";

/**
 * Expires every cached public read at once (#693), for the end-to-end tests that change the
 * database in SQL rather than through the back-office. Only exists when the server is started with
 * PUBLIC_CACHE_FLUSH_SECRET (never set in production) and the request carries it.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.PUBLIC_CACHE_FLUSH_SECRET;
  if (!secret || request.headers.get("x-flush-secret") !== secret) {
    return new Response(null, { status: 404 });
  }
  for (const tag of PUBLIC_TAGS) revalidateTag(tag, { expire: 0 });
  return new Response(null, { status: 204 });
}
