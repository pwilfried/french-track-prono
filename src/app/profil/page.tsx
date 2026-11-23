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
import { ShareSeasonCard } from "@/components/profile/share-season-card";
import { getMyPredictionHistory } from "@/application/list-my-predictions";
import { BadgeCelebration } from "@/components/profile/badge-celebration";
import { BadgeGrid } from "@/components/profile/badge-grid";
import { ProfileHelp } from "@/components/profile/profile-help";
import { ProfileStart } from "@/components/profile/profile-start";
import { TrophyCelebration } from "@/components/profile/trophy-celebration";
import { TrophyShowcase } from "@/components/profile/trophy-showcase";
import { Bib } from "@/components/profile/bib";
import { ClubNotices } from "@/components/account/club-notices";
import { rankingHref } from "@/components/leaderboard/ranking-href";
import { LatestPredictions } from "@/components/profile/prediction-history";
import { BestShot, SeasonCurve, SeasonTiles } from "@/components/profile/season-blocks";
import { Animal } from "@/components/band/animal";
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
 * The Profile tab (#768): the player's animal, pseudo and season at the top, the band, the
 * figures, the badges as bibs, the trophies, the account.
 */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ enregistre?: string; email?: string }>;
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
      <section
        aria-labelledby="me"
        className="flex items-center gap-4 rounded-card bg-brand-ink px-4 py-5 text-brand-foreground dark:bg-card dark:text-foreground"
      >
        <Animal kind={animal ?? "locked"} size="large" label className="size-24" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p id="me" className="flex min-w-0 items-center gap-2">
            <Bib bib={profile.bib} />
            <span className="min-w-0 break-words font-display text-xl font-extrabold">
              {profile.pseudo}
            </span>
          </p>
          <p className="font-semibold text-secondary">
            {animal
              ? `${messages.band.animals[animal]} · ${messages.band.families[animal]}`
              : messages.band.noAnimal}
          </p>
          <ProfileHelp className="-my-2" />
          {season && !starting && (
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-3xl font-bold">{season.points}</span>
              <span className="text-sm">
                {messages.format.ptsUnit(season.points)} ·{" "}
                <strong>
                  {season.rank ? text.rankOf(season.rank, season.players) : text.notRanked}
                </strong>
              </span>
            </p>
          )}
          <p className="text-xs opacity-80">
            {text.joined(details?.club?.validated ? details.club.name : null, since)}
          </p>
        </div>
      </section>

      {season && starting && (
        <ProfileStart
          predictions={season.stats.predictions}
          finalSlug={finalSlug}
          progress={badges?.progress ?? null}
        />
      )}
      {season && !starting && (
        <>
          <BandPoints band={season.band} animal={season.animal} toReach={season.toReach} />
          <SeasonTiles stats={season.stats} />
          <SeasonCurve curve={season.stats.curve} />
          <BestShot best={season.stats.bestShot} />
        </>
      )}
      {badges && !starting && <BadgeGrid progress={badges.progress} />}
      {shelves && (!starting || hasTrophies) && (
        <TrophyShowcase shelves={shelves} fresh={newTrophies.map(trophyKey)} />
      )}

      {honours.length > 0 && (
        <section aria-labelledby="honours" className="flex flex-col gap-2">
          <h2
            id="honours"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
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
      )}

      {season && !starting && <ShareSeasonCard />}
      {latest && latest.length > 0 && <LatestPredictions lines={latest} />}
      {/* The club ranking lives in the rankings tab (#1132): one way to see it. */}
      {details?.club?.validated && !starting && (
        <Link
          href={rankingHref("general", { clubs: true })}
          className="flex min-h-14 flex-col justify-center rounded-card border border-border bg-card px-4 py-2"
        >
          <span className="font-bold">{text.clubRanking}</span>
          <span className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {details.club.name}
          </span>
        </Link>
      )}
    </main>
  );
}
