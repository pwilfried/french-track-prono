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
 * One value cached under each public tag: it changes once a flush has expired that tag (#814). On
 * Vercel the flush answers before its expiry runs, and each tag expires on its own (#840), so the
 * tests read these lines until every one has changed (src/infra/contract/public-cache-flush.ts).
 */
const probes = PUBLIC_TAGS.map((tag) => ({
  tag,
  read: unstable_cache(async () => crypto.randomUUID(), ["public", "flush-probe", tag], {
    tags: [tag],
  }),
}));

export async function GET(request: NextRequest) {
  if (!allowed(request)) return new Response(null, { status: 404 });
  const lines = await Promise.all(probes.map(async (p) => `${p.tag}=${await p.read()}`));
  return new Response(lines.join("\n"), { headers: { "cache-control": "no-store" } });
}

function allowed(request: NextRequest): boolean {
  const secret = process.env.PUBLIC_CACHE_FLUSH_SECRET;
  return Boolean(secret) && request.headers.get("x-flush-secret") === secret;
}
