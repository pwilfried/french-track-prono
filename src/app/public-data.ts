import { unstable_cache, updateTag } from "next/cache";

import {
  createPublicSupabaseClient,
  createSupabaseCompetitionAdminRepository,
  createSupabaseDisciplineRepository,
  createSupabaseEventReader,
  createSupabaseScoringRuleRepository,
} from "@/infra";

import {
  cachedCompetitions,
  cachedDisciplines,
  cachedEventReader,
  cachedScale,
  PUBLIC_CACHE_SECONDS,
  STALE_AFTER,
  type Memo,
  type PublicChange,
} from "./public-cache";

/**
 * The Next.js data cache, shared by every request (and every server instance on Vercel). Only
 * public reads go through it: the anonymous Supabase client, no cookie, no player.
 */
const memo: Memo = (read, key, tags) =>
  unstable_cache(read, ["public", key], { tags: [...tags], revalidate: PUBLIC_CACHE_SECONDS });

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
 * After an admin change (Server Actions only): the matching cached reads expire at once, the next
 * page load reads them again.
 */
export function publicDataChanged(change: PublicChange): void {
  for (const tag of STALE_AFTER[change]) updateTag(tag);
}
