import Link from "next/link";
import { redirect } from "next/navigation";

import { getClubNotices } from "@/application/club-notices";
import { getMyBadges } from "@/application/get-my-badges";
import { getProfile } from "@/application/get-profile";
import { listEvents } from "@/application/list-events";
import { getPlayerDetails } from "@/application/player-details";
import { getMySeason } from "@/application/get-my-season";
import { getMyManagerHonours } from "@/application/manager-honours";
import { getNewTrophies, getTrophyShowcase } from "@/application/trophies";
import { getMyPredictionHistory } from "@/application/list-my-predictions";
import { RankingTabs } from "@/components/leaderboard/ranking-tabs";
import { AthleteCard } from "@/components/profile/athlete-card";
import { tabPanelProps } from "@/components/ui/view-tabs";
import { BadgeCelebration } from "@/components/profile/badge-celebration";
import { BadgeGrid } from "@/components/profile/badge-grid";
import { ProfileStart } from "@/components/profile/profile-start";
import { TrophyCelebration } from "@/components/profile/trophy-celebration";
import { TrophyShowcase } from "@/components/profile/trophy-showcase";
import { ClubNotices } from "@/components/account/club-notices";
import { LatestPredictions } from "@/components/profile/prediction-history";
import { BestShot, SeasonCurve, SeasonTiles } from "@/components/profile/season-blocks";
import { AnimalChange } from "@/components/band/animal-change";
import { BandPoints } from "@/components/band/band-points";
import { TIME_ZONE } from "@/domain/competition";
import { firstFinalToPredict } from "@/domain/home";
import { trophyKey } from "@/domain/trophies";
import {
  createSupabaseClubNoticeRepository,
  createSupabaseManagerHonoursRepository,
  createSupabasePlayerDetailsRepository,
  createSupabasePointsRepository,
  createSupabasePredictionRepository,
  createSupabaseTrophyRepository,
} from "@/infra";

import { currentCompetition, seasonCompetitionSlugs } from "../competition";
import { messages } from "../messages.fr";
import { getCurrentUser, getSessionClient, getSessionProfiles } from "../session";
import { markBadgesSeenAction } from "./badge-actions";
import { badgePorts } from "./badge-ports";
import { markTrophiesSeenAction } from "./trophy-actions";
import { publicEventReader, publicDisciplines, publicRanking } from "../public-data";
import { readOr } from "../read-or";

const PROFILE_VIEWS = ["saison", "badges", "vitrine"] as const;

/**
 * The season and the badges over every competition, the latest predictions: each read on its own, so one that fails only hides its own block (#763).
 */
async function loadSeason(userId: string) {
  const slugs = await seasonCompetitionSlugs();
  const client = await getSessionClient();
  const events = publicEventReader();
  const [season, badges, latest] = await Promise.all([
    readOr(
      "profile season",
      getMySeason({
        ranking: publicRanking(),
        predictions: createSupabasePredictionRepository(client),
        events,
        disciplines: publicDisciplines(),
      }).execute({ userId, competitionSlugs: slugs }),
      null,
    ),
    readOr(
      "profile badges",
      getMyBadges(badgePorts(client)).execute({ userId, competitionSlugs: slugs }),
      null,
    ),
    readOr(
      "profile latest predictions",
      getMyPredictionHistory({
        predictions: createSupabasePredictionRepository(client),
        events,
        points: createSupabasePointsRepository(client),
      }).execute({ userId, competitionSlugs: slugs, limit: 3 }),
      null,
    ),
  ]);
  return { season, badges, latest };
}

/** The next open final of the current competition, for the card of a new profile (#799). */
async function nextOpenFinal(): Promise<string | null> {
  const competition = await currentCompetition();
  const events = await readOr(
    "profile next final",
    listEvents({ events: publicEventReader() }).execute({ competitionSlug: competition.slug }),
    [],
  );
  return firstFinalToPredict(events, new Date());
}

/**
 * The Profile tab (#768, #1138): the athlete card, then three tabs kept in the URL (`?vue=`):
 * the season, the badges, the showcase of trophies.
 */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ enregistre?: string; email?: string; vue?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/profil")}`);

  const client = await getSessionClient();
  const profile = await getProfile({ profiles: await getSessionProfiles() }).execute({
    userId: user.userId,
  });
  if (!profile) redirect(`/bienvenue?next=${encodeURIComponent("/profil")}`);
  const [{ season, badges, latest }, details, params, clubNotices, honours, shelves, newTrophies] =
    await Promise.all([
      loadSeason(user.userId),
      readOr(
        "profile details",
        getPlayerDetails({ details: createSupabasePlayerDetailsRepository(client) }).execute({
          userId: user.userId,
        }),
        null,
      ),
      searchParams,
      readOr(
        "club notices",
        getClubNotices({ notices: createSupabaseClubNoticeRepository(client) }).execute(),
        [],
      ),
      readOr(
        "manager honours",
        getMyManagerHonours({
          honours: createSupabaseManagerHonoursRepository(client),
          userId: user.userId,
        }).execute(),
        [],
      ),
      readOr(
        "trophies",
        getTrophyShowcase({ trophies: createSupabaseTrophyRepository(client) }).execute({
          userId: user.userId,
        }),
        null,
      ),
      readOr(
        "new trophies",
        getNewTrophies({ trophies: createSupabaseTrophyRepository(client) }).execute({
          userId: user.userId,
        }),
        [],
      ),
    ]);
  const notice = params.email
    ? messages.changeEmail.done
    : params.enregistre
      ? messages.editProfile.saved
      : null;

  const since = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(profile.ageConfirmedAt);
  const text = messages.profile;
  const animal = season?.animal ?? null;
  // Before the first computed event, one card instead of a wall of empty boxes (#799).
  const starting = season !== null && season.stats.curve.length === 0;
  const finalSlug = starting ? await nextOpenFinal() : null;
  const hasTrophies = shelves !== null && shelves.length > 0;
  // A new player sees no tabs, unless a trophy was already awarded: then the showcase is theirs.
  const showTabs = !starting || hasTrophies;
  const view = PROFILE_VIEWS.find((v) => v === params.vue) ?? PROFILE_VIEWS[0];
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">{messages.settings.profileTitle}</h1>
        <Link
          href="/profil/reglages"
          aria-label={messages.settings.open}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-card text-xl"
        >
          <span aria-hidden="true">⚙️</span>
        </Link>
      </div>
      <ClubNotices notices={clubNotices} />
      <TrophyCelebration trophies={newTrophies} onSeen={markTrophiesSeenAction} />
      {badges && <BadgeCelebration raised={badges.raised} onSeen={markBadgesSeenAction} />}
      {notice ? (
        <p role="status" className="rounded-card bg-muted p-4 font-semibold">
          {notice}
        </p>
      ) : null}
      <AnimalChange animal={season?.animal ?? null} />
      <AthleteCard
        pseudo={profile.pseudo}
        bib={profile.bib}
        animal={animal}
        club={details?.club?.validated ? details.club.name : null}
        since={since}
        figures={
          season && !starting
            ? { points: season.points, rank: season.rank, players: season.players }
            : null
        }
      />

      {season && starting && !hasTrophies && (
        <ProfileStart
          predictions={season.stats.predictions}
          finalSlug={finalSlug}
          progress={badges?.progress ?? null}
        />
      )}
      {showTabs && (
        <>
          <RankingTabs
            label={text.tabsLabel}
            tabs={PROFILE_VIEWS.map((v) => ({
              id: v,
              label: text.tabs[v],
              href: v === "saison" ? "/profil" : `/profil?vue=${v}`,
            }))}
            selected={view}
            idPrefix="vue"
            panelId="profil-vue"
          />
          <div
            id="profil-vue"
            {...tabPanelProps(PROFILE_VIEWS.length, "vue", view)}
            className="flex flex-col gap-5"
          >
            {view === "saison" &&
              (season ? (
                starting ? (
                  <ProfileStart
                    predictions={season.stats.predictions}
                    finalSlug={finalSlug}
                    progress={badges?.progress ?? null}
                  />
                ) : (
                  <>
                    <SeasonTiles stats={season.stats} />
                    <BandPoints
                      band={season.band}
                      animal={season.animal}
                      toReach={season.toReach}
                    />
                    <SeasonCurve curve={season.stats.curve} />
                    <BestShot best={season.stats.bestShot} />
                    {latest && latest.length > 0 && <LatestPredictions lines={latest} />}
                  </>
                )
              ) : (
                <Unavailable />
              ))}
            {view === "badges" &&
              (badges ? <BadgeGrid progress={badges.progress} /> : <Unavailable />)}
            {view === "vitrine" && (
              <>
                {shelves ? (
                  <TrophyShowcase shelves={shelves} fresh={newTrophies.map(trophyKey)} />
                ) : (
                  <Unavailable />
                )}
                {honours.length > 0 && <Honours honours={honours} />}
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function Unavailable() {
  return (
    <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
      {messages.profile.unavailable}
    </p>
  );
}

/** « Palmarès Manager »: the finished manager seasons, the champion on gold. */
function Honours({
  honours,
}: {
  honours: {
    leagueId: string;
    leagueName: string;
    champion: boolean;
    rank: number;
    players: number;
  }[];
}) {
  return (
    <section aria-labelledby="honours" className="flex flex-col gap-2">
      <h2 id="honours" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {messages.managerSeasonEnd.honoursTitle}
      </h2>
      <ul aria-labelledby="honours" className="flex flex-col gap-1.5">
        {honours.map((h) => (
          <li key={h.leagueId}>
            <Link
              href={`/manager/${h.leagueId}/fin-de-saison`}
              className={`flex min-h-12 items-center justify-between gap-3 rounded-card border px-4 py-2 font-semibold ${h.champion ? "border-transparent bg-gold-soft text-gold-ink" : "border-border bg-card"}`}
            >
              <span className="min-w-0 break-words">{h.leagueName}</span>
              <span className="shrink-0 text-sm">
                {messages.managerSeasonEnd.honourPlace(h.champion, h.rank, h.players)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
