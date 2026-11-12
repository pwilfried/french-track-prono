import { getClubNotices, type ClubNotice } from "@/application/club-notices";
import { UseCaseError } from "@/application/errors";
import { getMyPoints } from "@/application/get-my-points";
import { getProfile } from "@/application/get-profile";
import { listEvents } from "@/application/list-events";
import { countPredictions, listMyPredictions } from "@/application/list-my-predictions";
import { isMercatoOpenForMe } from "@/application/manager-bids";
import { askToCompleteProfile } from "@/application/profile-reminder";
import { getLeagueRanking } from "@/application/rankings";
import type { PlayerHomeProps } from "@/components/home/player-home";
import { leagueStanding, nextAction } from "@/domain/home";
import {
  createPublicSupabaseClient,
  createSupabaseClubNoticeRepository,
  createSupabaseEventReader,
  createSupabaseLeagueRepository,
  createSupabaseManagerBids,
  createSupabaseManagerLeagueRepository,
  createSupabasePlayerDetailsRepository,
  createSupabasePointsRepository,
  createSupabasePredictionRepository,
  createSupabaseProfileReminderRepository,
  createSupabaseProfileRepository,
  createSupabaseRankingRepository,
} from "@/infra";

import {
  currentCompetition,
  loadCompetitions,
  loadMyLeagues,
  playerCompetitions,
} from "./competition";
import { canSeeManager } from "./manager-access";
import { getSessionClient } from "./session";

/** Everything the signed-in player's home shows (#526); each part empty when it cannot be read. */
export type PlayerHome = Omit<
  PlayerHomeProps,
  "userId" | "now" | "exactPoints" | "perfectPoints" | "completeProfile"
> & {
  clubNotices: ClubNotice[];
  /** Null unless the profile is incomplete and « Plus tard » does not hide the card (#540). */
  completeProfile: { firstPodium: boolean } | null;
};

async function safely<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}

export async function loadPlayerHome(userId: string, now: Date): Promise<PlayerHome | null> {
  const client = await getSessionClient();
  const profile = await safely(() =>
    getProfile({ profiles: createSupabaseProfileRepository(client) }).execute({ userId }),
  );
  if (!profile) return null;

  const [choices, leagues, lists, showManager] = await Promise.all([
    playerCompetitions(),
    loadMyLeagues(),
    loadCompetitions(),
    canSeeManager(userId),
  ]);
  const competition = await currentCompetition(choices.preferred);
  const ranking = createSupabaseRankingRepository(client);
  const predictions = createSupabasePredictionRepository(client);
  const leagueRepository = createSupabaseLeagueRepository(client);
  const listed = [...lists.coming, ...lists.past].map((c) => c.slug);

  const [events, mine, myPoints, rankings, clubNotices, predictionCount, mercatoOpen, askProfile] =
    await Promise.all([
      safely(() =>
        listEvents({ events: createSupabaseEventReader(createPublicSupabaseClient()) }).execute({
          competitionSlug: competition.slug,
        }),
      ),
      safely(() =>
        listMyPredictions({ predictions }).execute({ userId, competitionSlug: competition.slug }),
      ),
      safely(() =>
        getMyPoints({ points: createSupabasePointsRepository(client) }).execute({
          userId,
          competitionSlug: competition.slug,
        }),
      ),
      Promise.all(
        leagues.map(async (league) => ({
          id: league.id,
          rows:
            (await safely(() =>
              getLeagueRanking({ ranking, leagues: leagueRepository }).execute({
                leagueId: league.id,
                competitionSlugs: league.competitionSlugs,
              }),
            )) ?? [],
        })),
      ),
      safely(() =>
        getClubNotices({ notices: createSupabaseClubNoticeRepository(client) }).execute(),
      ),
      safely(() =>
        countPredictions({ predictions }).execute({
          userId,
          competitionSlugs: [...new Set([competition.slug, ...listed])],
        }),
      ),
      showManager
        ? safely(() =>
            isMercatoOpenForMe({
              managerLeagues: createSupabaseManagerLeagueRepository(client),
              bids: createSupabaseManagerBids(client),
            }).execute(),
          )
        : null,
      safely(() =>
        askToCompleteProfile({
          details: createSupabasePlayerDetailsRepository(client),
          reminders: createSupabaseProfileReminderRepository(client),
        }).execute({ userId, now }),
      ),
    ]);

  const standing = leagueStanding(rankings, userId);
  const shownLeague = leagues.find((l) => l.id === standing?.leagueId) ?? leagues[0];
  const scored = new Map((myPoints?.events ?? []).map((e) => [e.eventId, e]));
  const last = (events ?? [])
    .filter((event) => event.status === "finished" && scored.has(event.id))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
  const lastPoints = last ? scored.get(last.id)! : null;

  return {
    clubNotices: clubNotices ?? [],
    pseudo: profile.pseudo,
    // When it cannot be read, the steps stay hidden rather than shown to a seasoned player.
    isNew: predictionCount === 0,
    completeProfile: askProfile ? { firstPodium: predictionCount === 1 } : null,
    action: nextAction({
      events: events ?? [],
      predicted: new Set((mine ?? []).map((p) => p.eventId)),
      competitions: lists.coming,
      now,
    }),
    competitionSlug: competition.slug,
    league: shownLeague
      ? {
          id: shownLeague.id,
          name: shownLeague.name,
          standing: standing?.leagueId === shownLeague.id ? standing : null,
        }
      : null,
    lastResult:
      last && lastPoints
        ? {
            event: last,
            points: lastPoints.points,
            exact: lastPoints.reasons.filter((r) => r.kind === "exact").length,
            onPodium: lastPoints.reasons.filter((r) => r.kind === "on_podium").length,
          }
        : null,
    manager: showManager ? { mercatoOpen: mercatoOpen ?? false } : null,
  };
}
