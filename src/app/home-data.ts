import { getClubNotices, type ClubNotice } from "@/application/club-notices";
import { getMyPoints } from "@/application/get-my-points";
import { getProfile } from "@/application/get-profile";
import { listEvents } from "@/application/list-events";
import { listMyPredictions } from "@/application/list-my-predictions";
import { getGeneralRanking, getLeagueRanking, type RankingRow } from "@/application/rankings";
import { UseCaseError } from "@/application/errors";
import type { EventSummary } from "@/domain/event";
import { openFinals, type OpenFinal } from "@/domain/home";
import {
  createPublicSupabaseClient,
  createSupabaseClubNoticeRepository,
  createSupabaseEventReader,
  createSupabaseLeagueRepository,
  createSupabasePointsRepository,
  createSupabasePredictionRepository,
  createSupabaseProfileRepository,
  createSupabaseRankingRepository,
} from "@/infra";

import {
  currentCompetition,
  loadCompetitions,
  loadMyLeagues,
  playerCompetitions,
  type ShownCompetition,
} from "./competition";
import { getSessionClient } from "./session";

/** Everything the signed-in player's home shows (#346); each part null when it cannot be read. */
export type PlayerHome = {
  pseudo: string;
  competition: ShownCompetition;
  /** A player predicts from a league counting the competition (#311); without one, the home
   * offers to create a private or a public league (#369). */
  hasLeagueForCompetition: boolean;
  /** The finals still open, the next first. */
  finals: OpenFinal[];
  general: { me: RankingRow | null; total: number; podium: RankingRow[] } | null;
  league: { id: string; name: string; me: RankingRow | null } | null;
  lastResult: { event: EventSummary; points: number | null } | null;
  clubNotices: ClubNotice[];
};

async function safely<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}

export async function loadPlayerHome(userId: string): Promise<PlayerHome | null> {
  const client = await getSessionClient();
  const profile = await safely(() =>
    getProfile({ profiles: createSupabaseProfileRepository(client) }).execute({ userId }),
  );
  if (!profile) return null;

  const [choices, leagues, lists] = await Promise.all([
    playerCompetitions(),
    loadMyLeagues(),
    loadCompetitions(),
  ]);
  const competition = await currentCompetition(choices.preferred);
  const ranking = createSupabaseRankingRepository(client);

  const [events, mine, myPoints, general, leagueRows, clubNotices] = await Promise.all([
    safely(() =>
      listEvents({ events: createSupabaseEventReader(createPublicSupabaseClient()) }).execute({
        competitionSlug: competition.slug,
      }),
    ),
    safely(() =>
      listMyPredictions({ predictions: createSupabasePredictionRepository(client) }).execute({
        userId,
        competitionSlug: competition.slug,
      }),
    ),
    safely(() =>
      getMyPoints({ points: createSupabasePointsRepository(client) }).execute({
        userId,
        competitionSlug: competition.slug,
      }),
    ),
    safely(() =>
      getGeneralRanking({ ranking }).execute({
        competitionSlugs: [...lists.coming, ...lists.past].map((c) => c.slug),
      }),
    ),
    leagues[0]
      ? safely(() =>
          getLeagueRanking({ ranking, leagues: createSupabaseLeagueRepository(client) }).execute({
            leagueId: leagues[0]!.id,
            competitionSlugs: leagues[0]!.competitionSlugs,
          }),
        )
      : Promise.resolve(null),
    safely(() => getClubNotices({ notices: createSupabaseClubNoticeRepository(client) }).execute()),
  ]);

  const predicted = new Set((mine ?? []).map((p) => p.eventId));
  const finished = (events ?? [])
    .filter((event) => event.status === "finished")
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];

  return {
    clubNotices: clubNotices ?? [],
    pseudo: profile.pseudo,
    competition,
    hasLeagueForCompetition: leagues.some((l) => l.competitionSlugs.includes(competition.slug)),
    finals: events ? openFinals(events, predicted, new Date()) : [],
    general: general
      ? {
          me: general.find((row) => row.userId === userId) ?? null,
          total: general.length,
          podium: general.slice(0, 3),
        }
      : null,
    league:
      leagues[0] && leagueRows
        ? {
            id: leagues[0].id,
            name: leagues[0].name,
            me: leagueRows.find((row) => row.userId === userId) ?? null,
          }
        : null,
    lastResult: finished
      ? {
          event: finished,
          points: myPoints?.events.find((e) => e.eventId === finished.id)?.points ?? null,
        }
      : null,
  };
}
