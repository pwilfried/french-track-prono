import { cache } from "react";

import type { CompetitionSummary } from "@/application/create-competition";
import { UseCaseError } from "@/application/errors";
import { listCompetitions } from "@/application/list-competitions";
import { nextCompetition } from "@/domain/competition";
import { createPublicSupabaseClient, createSupabaseCompetitionAdminRepository } from "@/infra";

import { messages } from "./messages.fr";

/** The competition a page shows, with its French place line ("Budapest · 11 – 13 sept. 2026"). */
export type ShownCompetition = CompetitionSummary & { place: string };

const shown = (c: CompetitionSummary): ShownCompetition => ({
  ...c,
  place: [c.city, messages.competition.dates(c.startsOn, c.endsOn)].filter(Boolean).join(" · "),
});

/** Colours of the « Internationale » / « Française » chip. */
export const SCOPE_CHIP = {
  international: "bg-brand-soft text-brand-ink",
  france: "bg-primary-soft text-primary-ink",
} as const;

/** Today as YYYY-MM-DD (UTC), the format of competition dates. */
export const currentDay = () => new Date().toISOString().slice(0, 10);

/** Every competition (public read), the coming ones first; empty lists when they cannot be read. */
export const loadCompetitions = cache(
  async (): Promise<{ coming: ShownCompetition[]; past: ShownCompetition[] }> => {
    try {
      const lists = await listCompetitions({
        competitions: createSupabaseCompetitionAdminRepository(createPublicSupabaseClient()),
      }).execute({ today: currentDay() });
      return { coming: lists.coming.map(shown), past: lists.past.map(shown) };
    } catch (error) {
      if (error instanceof UseCaseError) return { coming: [], past: [] };
      throw error;
    }
  },
);

/** Shown when no competition can be read: the pages then tell their own error. */
const FALLBACK: ShownCompetition = {
  slug: "ultimate-championship-2026",
  name: messages.app.name,
  scope: "international",
  city: null,
  countryCode: null,
  startsOn: "2026-09-11",
  endsOn: "2026-09-13",
  timeZone: "Europe/Paris",
  events: 0,
  entered: 0,
  place: "",
};

/**
 * The competition a page follows: the one asked for (`slug`), else the one set by COMPETITION_SLUG
 * (server environment, used to pin the tests), else the next one by date.
 */
export const currentCompetition = cache(async (slug?: string): Promise<ShownCompetition> => {
  const { coming, past } = await loadCompetitions();
  const all = [...coming, ...past];
  const asked = slug ?? process.env.COMPETITION_SLUG;
  return (
    (asked ? all.find((c) => c.slug === asked) : undefined) ??
    nextCompetition(all, currentDay()) ??
    FALLBACK
  );
});
