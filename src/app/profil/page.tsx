import Link from "next/link";
import { redirect } from "next/navigation";

import { getClubNotices } from "@/application/club-notices";
import { getMyBadges } from "@/application/get-my-badges";
import { getProfile } from "@/application/get-profile";
import { getPlayerDetails } from "@/application/player-details";
import { getMySeason } from "@/application/get-my-season";
import { getMyManagerHonours } from "@/application/manager-honours";
import { ShareSeasonCard } from "@/components/profile/share-season-card";
import { getMyPredictionHistory } from "@/application/list-my-predictions";
import { getClubRanking } from "@/application/rankings";
import { BadgeGrid } from "@/components/profile/badge-grid";
import { Bib } from "@/components/profile/bib";
import { InstallEntry } from "@/components/shell/install-prompt";
import { NotificationOptIn } from "@/components/account/notification-opt-in";
import { ClubNotices } from "@/components/account/club-notices";
import { ClubRanking } from "@/components/profile/club-ranking";
import { LatestPredictions } from "@/components/profile/prediction-history";
import {
  BestShot,
  SeasonCurve,
  SeasonTiles,
  StrongFamilies,
} from "@/components/profile/season-blocks";
import { buttonVariants } from "@/components/ui/button";
import { TIME_ZONE } from "@/domain/competition";
import {
  createSupabaseClubNoticeRepository,
  createSupabaseManagerHonoursRepository,
  createSupabasePlayerDetailsRepository,
  createSupabasePointsRepository,
  createSupabasePredictionRepository,
  createSupabaseProfileRepository,
  createSupabaseRankingRepository,
} from "@/infra";

import { currentCompetition, seasonCompetitionSlugs } from "../competition";
import { messages } from "../messages.fr";
import { turnOffNotificationsAction, turnOnNotificationsAction } from "../push-actions";
import { getCurrentUser, getSessionClient } from "../session";
import { publicEventReader, publicDisciplines } from "../public-data";
import { readOr } from "../read-or";

/**
 * The season and the club ranking over every competition, the badges of the current one, the
 * latest predictions: each read on its own, so one that fails only hides its own block (#763).
 */
async function loadSeason(userId: string) {
  const competition = await currentCompetition();
  const slugs = await seasonCompetitionSlugs();
  const client = await getSessionClient();
  const events = publicEventReader();
  const [season, badges, clubs, latest] = await Promise.all([
    readOr(
      "profile season",
      getMySeason({
        ranking: createSupabaseRankingRepository(client),
        predictions: createSupabasePredictionRepository(client),
        events,
        disciplines: publicDisciplines(),
      }).execute({ userId, competitionSlugs: slugs }),
      null,
    ),
    readOr(
      "profile badges",
      getMyBadges({
        ranking: createSupabaseRankingRepository(client),
        predictions: createSupabasePredictionRepository(client),
        events,
      }).execute({ userId, competitionSlug: competition.slug }),
      null,
    ),
    readOr(
      "profile clubs",
      getClubRanking({ ranking: createSupabaseRankingRepository(client) }).execute({
        competitionSlugs: slugs,
      }),
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
  return { season, badges, clubs, latest };
}

/** Board 06: bib and pseudo, the season in three figures, the account. */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ enregistre?: string; email?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/profil")}`);

  const client = await getSessionClient();
  const profile = await getProfile({
    profiles: createSupabaseProfileRepository(client),
  }).execute({ userId: user.userId });
  if (!profile) redirect(`/bienvenue?next=${encodeURIComponent("/profil")}`);
  const [{ season, badges, clubs, latest }, details, params, clubNotices, honours] =
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
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <h1 className="sr-only">{text.title}</h1>
      <ClubNotices notices={clubNotices} />
      {notice ? (
        <p role="status" className="rounded-card bg-muted p-4 font-semibold">
          {notice}
        </p>
      ) : null}
      <section
        aria-labelledby="me"
        className="flex flex-col items-center gap-1 rounded-card bg-brand-ink px-4 py-6 text-center text-brand-foreground dark:bg-card dark:text-foreground"
      >
        <Bib bib={profile.bib} size="large" pseudo={profile.pseudo} className="max-w-52" />
        {/* The bib prints the pseudo; this one names the section for screen readers. */}
        <p id="me" className="sr-only">
          {profile.pseudo}
        </p>
        <p className="text-sm opacity-80">
          {text.joined(details?.club?.validated ? details.club.name : null, since)}
        </p>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-4xl font-bold text-secondary">
            {season ? season.points : "–"}
          </span>
          <span className="text-sm">
            {messages.format.ptsUnit(season?.points ?? 0)} ·{" "}
            <strong>
              {season?.rank ? text.rankOf(season.rank, season.players) : text.notRanked}
            </strong>
          </span>
        </p>
      </section>

      {season && (
        <>
          <ShareSeasonCard />
          <SeasonTiles stats={season.stats} />
          <SeasonCurve curve={season.stats.curve} />
        </>
      )}
      {latest && <LatestPredictions lines={latest} />}
      {season && (
        <>
          <BestShot best={season.stats.bestShot} />
          <StrongFamilies families={season.stats.families} />
        </>
      )}
      {clubs && (
        <ClubRanking clubs={clubs} myClub={details?.club?.validated ? details.club : null} />
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

      <section aria-labelledby="season" className="flex flex-col gap-2">
        <h2
          id="season"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          {text.season}
        </h2>
        <Link
          href="/mes-points"
          className="flex min-h-11 items-center justify-between rounded-card border border-border bg-card px-4 font-semibold"
        >
          {messages.points.profileLink}
          <span aria-hidden="true">›</span>
        </Link>
        <Link
          href="/ligues"
          className="flex min-h-11 items-center justify-between rounded-card border border-border bg-card px-4 font-semibold"
        >
          {messages.points.leaguesLink}
          <span aria-hidden="true">›</span>
        </Link>
        <Link
          href="/regles"
          className="flex min-h-11 items-center justify-between rounded-card border border-border bg-card px-4 font-semibold"
        >
          {messages.rules.link}
          <span aria-hidden="true">›</span>
        </Link>
        <InstallEntry />
        <NotificationOptIn
          turnOn={turnOnNotificationsAction}
          turnOff={turnOffNotificationsAction}
        />
      </section>

      {badges && <BadgeGrid progress={badges} />}

      <section aria-labelledby="account" className="flex flex-col gap-2">
        <h2
          id="account"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          {text.account}
        </h2>
        <dl className="flex flex-col divide-y divide-border rounded-card border border-border bg-card">
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
            <div className="min-w-0">
              <dt className="text-sm font-bold">{text.pseudo}</dt>
              <dd className="break-words text-sm text-muted-foreground">{profile.pseudo}</dd>
            </div>
          </div>
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
            <div className="min-w-0">
              <dt className="text-sm font-bold">{messages.editProfile.club}</dt>
              <dd className="break-words text-sm text-muted-foreground">
                {details?.club
                  ? `${details.club.name}${details.club.validated ? "" : ` (${messages.editProfile.toValidate})`}`
                  : messages.editProfile.noClub}
              </dd>
            </div>
          </div>
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
            <div className="min-w-0">
              <dt className="text-sm font-bold">
                {text.email}{" "}
                <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
                  {text.private}
                </span>
              </dt>
              <dd className="break-all text-sm text-muted-foreground">{user.email}</dd>
            </div>
            <Link
              href="/profil/email"
              aria-label={messages.changeEmail.title}
              className="inline-flex min-h-11 shrink-0 items-center font-semibold text-primary underline underline-offset-4"
            >
              {messages.changeEmail.link}
            </Link>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">{text.emailPrivate}</p>
        <Link
          href="/profil/modifier"
          className={`${buttonVariants({ variant: "outline" })} w-full`}
        >
          {messages.editProfile.link}
        </Link>
      </section>

      <form action="/auth/sign-out" method="post">
        <button type="submit" className={`${buttonVariants({ variant: "outline" })} w-full`}>
          {text.signOut}
        </button>
      </form>
      <Link
        href="/profil/supprimer"
        className="flex min-h-11 items-center justify-center text-sm font-semibold text-accent-text underline underline-offset-4"
      >
        {text.deleteLink}
      </Link>
    </main>
  );
}
