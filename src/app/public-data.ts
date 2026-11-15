import { unstable_cache, updateTag } from "next/cache";
import { connection } from "next/server";
import { cache } from "react";

import {
  createPublicSupabaseClient,
  createSupabaseCompetitionAdminRepository,
  createSupabaseDisciplineRepository,
  createSupabaseEventReader,
  createSupabaseRankingRepository,
  createSupabaseScoringRuleRepository,
} from "@/infra";

import {
  cachedCompetitions,
  cachedDisciplines,
  cachedEventReader,
  cachedRanking,
  cachedScale,
  PUBLIC_CACHE_SECONDS,
  STALE_AFTER,
  type Memo,
  type PublicChange,
} from "./public-cache";

/** The reads already asked during this page render; a new map outside a render (#824). */
const askedThisRender = cache(() => new Map<string, Promise<unknown>>());

/**
 * The Next.js data cache, shared by every request (and every server instance on Vercel). Only
 * public reads go through it: the anonymous Supabase client, no cookie, no player. Within one
 * page render, the same read asked twice (the rankings of two leagues over one competition) is
 * asked once (#824). Never read while prerendering at build time (#919).
 */
const memo: Memo = (read, key, tags) => {
  const shared = unstable_cache(read, ["public", key], {
    tags: [...tags],
    revalidate: PUBLIC_CACHE_SECONDS,
  });
  return async (...args) => {
    // #919: `next build` stops prerendering here, before asking Supabase. A slow or unavailable
    // database at build time cannot fail the build; the page is rendered on request (as it was).
    await connection();
    const asked = askedThisRender();
    const id = JSON.stringify([key, ...args]);
    if (!asked.has(id)) asked.set(id, shared(...args));
    return asked.get(id) as ReturnType<typeof shared>;
  };
};

/** The events of a competition, cached; `findBySlug` (one event, its lock) is always read fresh. */
export const publicEventReader = () =>
  cachedEventReader(createSupabaseEventReader(createPublicSupabaseClient()), memo);

export const publicCompetitions = () =>
  cachedCompetitions(createSupabaseCompetitionAdminRepository(createPublicSupabaseClient()), memo);

export const publicDisciplines = () =>
  cachedDisciplines(createSupabaseDisciplineRepository(createPublicSupabaseClient()), memo);

export const publicScale = () =>
  cachedScale(createSupabaseScoringRuleRepository(createPublicSupabaseClient()), memo);

/**
 * The score lines of the rankings, cached (#824). Read without a session: a blocked player's own
 * lines, which only they see when signed in, are left out of the rankings for them too.
 */
export const publicRanking = () =>
  cachedRanking(createSupabaseRankingRepository(createPublicSupabaseClient()), memo);

/**
 * After a change (Server Actions only): the matching cached reads expire at once, the next page
 * load reads them again. `updateTag` also drops the pages kept by the browser.
 */
export function publicDataChanged(change: PublicChange): void {
  for (const tag of STALE_AFTER[change]) updateTag(tag);
}
