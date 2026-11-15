import { getClubNotices, type ClubNotice } from "@/application/club-notices";
import { UseCaseError } from "@/application/errors";
import { getHomeChallenge } from "@/application/frenchtrack";
import { getFunFacts } from "@/application/fun-facts";
import { getMyPoints } from "@/application/get-my-points";
import { getProfile } from "@/application/get-profile";
import { listEvents } from "@/application/list-events";
import { countPredictions, listMyPredictions } from "@/application/list-my-predictions";
import { isMercatoOpenForMe } from "@/application/manager-bids";
import { askToCompleteProfile } from "@/application/profile-reminder";
import { getLeagueRanking } from "@/application/rankings";
import type { PlayerHomeProps } from "@/components/home/player-home";
import type { Bib } from "@/domain/bib";
import { competitionDay } from "@/domain/competition";
import { challengeSeasonOf } from "@/domain/frenchtrack";
import type { FunFact } from "@/domain/fun-facts";
import { leagueStanding, nextAction } from "@/domain/home";
import {
  createSupabaseClubNoticeRepository,
  createSupabaseFrenchTrackRepository,
  createSupabaseFunFactRepository,
  createSupabaseLeagueRepository,
  createSupabaseManagerBids,
  createSupabaseManagerLeagueRepository,
  createSupabasePlayerDetailsRepository,
  createSupabasePointsRepository,
  createSupabasePredictionRepository,
  createSupabaseProfileReminderRepository,
} from "@/infra";

import {
  currentCompetition,
  loadCompetitions,
  loadMyLeagues,
  playerCompetitions,
} from "./competition";
import { gameFunFacts } from "./fun-facts";
import { loadScale } from "./scale";
import { getSessionClient, getSessionProfiles } from "./session";
import { publicEventReader, publicRanking } from "./public-data";

/** Everything the signed-in player's home shows (#526); each part empty when it cannot be read. */
export type PlayerHome = Omit<
  PlayerHomeProps,
  "userId" | "now" | "exactPoints" | "perfectPoints" | "completeProfile" | "funFact"
> & {
  clubNotices: ClubNotice[];
  /** « Le saviez-vous ? » (#766), in the order of the day; empty when off or unreadable. */
  funFacts: FunFact[];
  /**
   * The « Complète ton profil » card (#540). `ask` is false once the profile is complete or while
   * « Plus tard » hides it; the card stays mounted so its confirmation survives the save (#889).
   */
  completeProfile: { ask: boolean; firstPodium: boolean; bib: Bib; pseudo: string };
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
  const profiles = await getSessionProfiles();
  const profile = await safely(() => getProfile({ profiles }).execute({ userId }));
  if (!profile) return null;

  const [choices, leagues, lists] = await Promise.all([
    playerCompetitions(),
    loadMyLeagues(),
    loadCompetitions(),
  ]);
  const competition = await currentCompetition(choices.preferred);
  const ranking = publicRanking();
  const predictions = createSupabasePredictionRepository(client);
  const leagueRepository = createSupabaseLeagueRepository(client);
  const listed = [...lists.coming, ...lists.past].map((c) => c.slug);

  const [
    events,
    mine,
    myPoints,
    rankings,
    clubNotices,
    predictionCount,
    mercatoOpen,
    askProfile,
    scale,
    challenge,
  ] = await Promise.all([
    safely(() =>
      listEvents({ events: publicEventReader() }).execute({
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
              families: league.families,
              competitionAddedAt: league.competitionAddedAt,
            }),
          )) ?? [],
      })),
    ),
    safely(() => getClubNotices({ notices: createSupabaseClubNoticeRepository(client) }).execute()),
    safely(() =>
      countPredictions({ predictions }).execute({
        userId,
        competitionSlugs: [...new Set([competition.slug, ...listed])],
      }),
    ),
    safely(() =>
      isMercatoOpenForMe({
        managerLeagues: createSupabaseManagerLeagueRepository(client),
        bids: createSupabaseManagerBids(client),
      }).execute(),
    ),
    safely(() =>
      askToCompleteProfile({
        details: createSupabasePlayerDetailsRepository(client),
        reminders: createSupabaseProfileReminderRepository(client),
      }).execute({ userId, now }),
    ),
    loadScale(),
    safely(() =>
      getHomeChallenge({ frenchTrack: createSupabaseFrenchTrackRepository(client) }).execute({
        year: challengeSeasonOf(now.toISOString()),
        now,
      }),
    ),
  ]);

  const day = competitionDay(now.toISOString());
  const funFacts = await safely(() =>
    getFunFacts({ facts: createSupabaseFunFactRepository(client) }).execute({
      today: {
        day,
        competitions: [...lists.coming, ...lists.past],
        disciplines: (events ?? [])
          .filter((e) => competitionDay(e.startsAt) === day)
          .map((e) => e.discipline),
      },
      gameFacts: gameFunFacts(scale),
    }),
  );

  const standing = leagueStanding(rankings, userId);
  const shownLeague = leagues.find((l) => l.id === standing?.leagueId) ?? leagues[0];
  const scored = new Map((myPoints?.events ?? []).map((e) => [e.eventId, e]));
  const last = (events ?? [])
    .filter((event) => event.status === "finished" && scored.has(event.id))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
  const lastPoints = last ? scored.get(last.id)! : null;

  return {
    clubNotices: clubNotices ?? [],
    funFacts: funFacts ?? [],
    pseudo: profile.pseudo,
    // When it cannot be read, the steps stay hidden rather than shown to a seasoned player.
    isNew: predictionCount === 0,
    completeProfile: {
      ask: Boolean(askProfile),
      firstPodium: predictionCount === 1,
      bib: profile.bib,
      pseudo: profile.pseudo,
    },
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
    mercatoOpen: mercatoOpen ?? false,
    challenge,
  };
}
