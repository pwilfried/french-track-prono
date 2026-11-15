import Link from "next/link";
import { redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getChallengeSeason } from "@/application/frenchtrack";
import { AccountHero } from "@/components/account/account-hero";
import { ErrorNotice } from "@/components/error-notice";
import { Bib } from "@/components/profile/bib";
import { challengeSeasonOf } from "@/domain/frenchtrack";
import { createSupabaseFrenchTrackRepository } from "@/infra";
import { cn } from "@/lib/utils";

import { messages } from "../../messages.fr";
import { getCurrentUser, getSessionClient } from "../../session";

const text = messages.challenge;
const HERE = "/classement/frenchtrack";

/**
 * « Qui bat FrenchTrack le plus souvent ? » (#674): the players of the season's challenges, by
 * challenges won, then points on the challenges played; my place on top.
 */
export default async function FrenchTrackSeasonPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(HERE)}`);
  const year = challengeSeasonOf(new Date().toISOString());

  let season;
  try {
    season = await getChallengeSeason({
      frenchTrack: createSupabaseFrenchTrackRepository(await getSessionClient()),
    }).execute({ year, userId: user.userId });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    season = "error" as const;
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        <Link
          href="/classement"
          className="inline-flex min-h-11 items-center font-semibold text-brand dark:text-secondary"
        >
          ‹ {text.seasonBack}
        </Link>
      </div>
      <AccountHero title={text.seasonTitle} subtitle={String(year)} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-4">
        <p className="text-sm text-muted-foreground">{text.seasonIntro}</p>
        {season === "error" ? (
          <ErrorNotice retryHref={HERE} message={messages.errors.FRENCHTRACK_UNAVAILABLE} />
        ) : season.standings.length === 0 ? (
          <p className="rounded-card bg-muted p-4 text-muted-foreground">{text.seasonEmpty}</p>
        ) : (
          <>
            <p
              data-my-challenge-place
              className="rounded-card border border-white/15 bg-nuit p-4 font-bold text-white"
            >
              {season.mine
                ? `${text.myPlace(season.mine.rank)} · ${text.wins(season.mine.wins, season.mine.played)}`
                : text.notPlayed}
            </p>
            <ol className="flex flex-col gap-2">
              {season.standings.map((row) => {
                const me = row.userId === user.userId;
                return (
                  <li
                    key={row.userId}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2",
                      me && "border-2 border-brand dark:border-secondary",
                    )}
                  >
                    <span className="w-7 shrink-0 text-center font-mono text-sm font-bold">
                      {row.rank}
                    </span>
                    <Bib bib={row.bib} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="break-words font-bold">{row.pseudo}</span>
                      <span className="text-xs text-muted-foreground">
                        {text.wins(row.wins, row.played)}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                      {text.points(row.points)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </main>
  );
}
