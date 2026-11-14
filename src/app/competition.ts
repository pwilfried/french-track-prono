import { cache } from "react";

import type { CompetitionSummary } from "@/application/create-competition";
import { UseCaseError } from "@/application/errors";
import { listMyLeagues, type League } from "@/application/leagues";
import { listCompetitions } from "@/application/list-competitions";
import { competitionDay, competitionsForPlayer, nextCompetition } from "@/domain/competition";
import { createSupabaseLeagueRepository } from "@/infra";

import { messages } from "./messages.fr";
import { publicCompetitions } from "./public-data";
import { getCurrentUser, getSessionClient } from "./session";

/** The competition a page shows, with its French place line ("Budapest · 11–13 sept. 2026"). */
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

/** Today's competition day, Paris time (#551): rankings move from one to the next. */
export const currentCompetitionDay = () => competitionDay(new Date().toISOString());

/**
 * Every competition (public read, kept across requests: see public-data.ts), the coming ones
 * first; empty lists when they cannot be read.
 */
export const loadCompetitions = cache(
  async (): Promise<{ coming: ShownCompetition[]; past: ShownCompetition[] }> => {
    try {
      const lists = await listCompetitions({
        competitions: publicCompetitions(),
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
  venue: "outdoor",
  level: null,
  city: null,
  countryCode: null,
  startsOn: "2026-09-11",
  endsOn: "2026-09-13",
  events: 0,
  finals: 0,
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

/** Every competition of the season (the profile and its card add them up), else the current one. */
export async function seasonCompetitionSlugs(): Promise<string[]> {
  const { coming, past } = await loadCompetitions();
  const slugs = [...coming, ...past].map((c) => c.slug);
  return slugs.length ? slugs : [(await currentCompetition()).slug];
}

/** The signed-in player's leagues, by name; empty for a visitor or when they cannot be read. */
export const loadMyLeagues = cache(async (): Promise<League[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  try {
    return await listMyLeagues({
      leagues: createSupabaseLeagueRepository(await getSessionClient()),
    }).execute();
  } catch (error) {
    if (error instanceof UseCaseError) return [];
    throw error;
  }
});

/**
 * The competitions still to come, those of the player's leagues first (#352), and the one to show
 * by default: the next one of their leagues, unless COMPETITION_SLUG pins one for the tests.
 */
export const playerCompetitions = cache(async () => {
  const [lists, leagues] = await Promise.all([loadCompetitions(), loadMyLeagues()]);
  const choices = competitionsForPlayer(
    [...lists.coming, ...lists.past],
    leagues.flatMap((league) => league.competitionSlugs),
    currentDay(),
  );
  const preferred = process.env.COMPETITION_SLUG ? undefined : choices.mine[0]?.slug;
  return { ...choices, preferred };
});
