import { revalidateTag, unstable_cache } from "next/cache";
import type { NextRequest } from "next/server";

import { PUBLIC_TAGS } from "../../public-cache";

/**
 * Expires every cached public read at once (#693), for the end-to-end tests that change the
 * database in SQL rather than through the back-office. Only exists when the server is started with
 * PUBLIC_CACHE_FLUSH_SECRET (never set in production) and the request carries it.
 */
export async function POST(request: NextRequest) {
  if (!allowed(request)) return new Response(null, { status: 404 });
  for (const tag of PUBLIC_TAGS) revalidateTag(tag, { expire: 0 });
  return new Response(null, { status: 204 });
}

/**
 * A value cached under every public tag: it changes once a flush has expired them (#814). On
 * Vercel the flush answers before its expiry runs, so the tests read this until it changes
 * (src/infra/contract/public-cache-flush.ts).
 */
const probe = unstable_cache(async () => crypto.randomUUID(), ["public", "flush-probe"], {
  tags: [...PUBLIC_TAGS],
});

export async function GET(request: NextRequest) {
  if (!allowed(request)) return new Response(null, { status: 404 });
  return new Response(await probe(), { headers: { "cache-control": "no-store" } });
}

function allowed(request: NextRequest): boolean {
  const secret = process.env.PUBLIC_CACHE_FLUSH_SECRET;
  return Boolean(secret) && request.headers.get("x-flush-secret") === secret;
}
