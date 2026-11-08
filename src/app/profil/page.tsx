import Link from "next/link";
import { redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getMyBadges } from "@/application/get-my-badges";
import { getProfile } from "@/application/get-profile";
import { listEvents } from "@/application/list-events";
import { listMyPredictions } from "@/application/list-my-predictions";
import { getGeneralRanking } from "@/application/rankings";
import { buttonVariants } from "@/components/ui/button";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabasePredictionRepository,
  createSupabaseProfileRepository,
  createSupabaseRankingRepository,
} from "@/infra";

import { currentCompetition } from "../competition";
import { messages } from "../messages.fr";
import { getCurrentUser, getSessionClient } from "../session";

/** Rank, points and predictions of the season; null when they cannot be read. */
async function loadSeason(userId: string) {
  const competition = await currentCompetition();
  try {
    const client = await getSessionClient();
    const [ranking, mine, events] = await Promise.all([
      getGeneralRanking({ ranking: createSupabaseRankingRepository(client) }).execute({
        competitionSlug: competition.slug,
      }),
      listMyPredictions({ predictions: createSupabasePredictionRepository(client) }).execute({
        userId,
        competitionSlug: competition.slug,
      }),
      listEvents({ events: createSupabaseEventReader(createPublicSupabaseClient()) }).execute({
        competitionSlug: competition.slug,
      }),
    ]);
    const badges = await getMyBadges({
      ranking: createSupabaseRankingRepository(client),
      predictions: createSupabasePredictionRepository(client),
      events: createSupabaseEventReader(createPublicSupabaseClient()),
    }).execute({ userId, competitionSlug: competition.slug, timeZone: competition.timeZone });
    const me = ranking.find((p) => p.userId === userId);
    return {
      rank: me?.rank ?? null,
      points: me?.points ?? 0,
      predicted: mine.length,
      events: events.length,
      badges,
    };
  } catch (error) {
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}

/** Board 06: avatar and pseudo, the season in three figures, the account. */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/profil")}`);

  const profile = await getProfile({
    profiles: createSupabaseProfileRepository(await getSessionClient()),
  }).execute({ userId: user.userId });
  if (!profile) redirect(`/bienvenue?next=${encodeURIComponent("/profil")}`);
  const season = await loadSeason(user.userId);

  const since = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(profile.ageConfirmedAt);
  const text = messages.profile;
  const tiles = [
    { value: season?.rank ? `#${season.rank}` : "–", label: text.rank },
    { value: season ? String(season.points) : "–", label: text.points },
    { value: season ? `${season.predicted}/${season.events}` : "–", label: text.predictions },
  ];

  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <h1 className="sr-only">{text.title}</h1>
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-20 shrink-0 place-items-center rounded-full border-2 border-brand bg-card text-4xl dark:border-secondary"
        >
          {profile.avatar}
        </span>
        <div className="min-w-0">
          <p className="break-words font-display text-2xl font-extrabold">{profile.pseudo}</p>
          <p className="font-mono text-sm text-muted-foreground">{text.since(since)}</p>
        </div>
      </div>

      <section aria-labelledby="season" className="flex flex-col gap-2">
        <h2
          id="season"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          {text.season}
        </h2>
        <ul className="grid grid-cols-3 gap-2">
          {tiles.map((tile) => (
            <li
              key={tile.label}
              className="flex flex-col items-center gap-1 rounded-card border border-border bg-card px-2 py-3"
            >
              <span className="font-mono text-2xl font-bold tabular-nums">{tile.value}</span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {tile.label}
              </span>
            </li>
          ))}
        </ul>
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
      </section>

      <section aria-labelledby="badges" className="flex flex-col gap-2">
        <h2
          id="badges"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          {text.badges}
        </h2>
        {season && season.badges.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {season.badges.map((badge) => {
              const b = messages.badges[badge];
              return (
                <li
                  key={badge}
                  title={b.rule}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-gold-soft px-3 text-sm font-bold text-gold-ink"
                >
                  <span aria-hidden="true">{b.emoji}</span>
                  {b.name}
                  <span className="sr-only">: {b.rule}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.noBadge}</p>
        )}
      </section>

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
              <dt className="text-sm font-bold">{text.email}</dt>
              <dd className="text-sm text-muted-foreground">{text.emailPrivate}</dd>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-bold">
              {text.private}
            </span>
          </div>
        </dl>
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
