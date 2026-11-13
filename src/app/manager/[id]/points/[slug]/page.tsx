import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getMyManagerScore, type MyManagerScore } from "@/application/manager-scores";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { athleteInitials } from "@/domain/manager-team";
import { createSupabaseManagerLineups, createSupabaseManagerScoreRepository } from "@/infra";

import { messages } from "../../../../messages.fr";
import { getSessionClient } from "../../../../session";
import { managerPorts } from "../../../data";

const text = messages.managerPoints;

/**
 * « Mes points » (#431): the Manager score of the player for one competition of the league, the
 * three parts, then every lined-up athlete from the strongest to the weakest with their bonuses.
 */
export default async function ManagerPointsPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;
  const path = `/manager/${id}/points/${slug}`;
  await managerPorts(path);
  const client = await getSessionClient();
  let mine: MyManagerScore | "error";
  try {
    mine = await getMyManagerScore({
      lineups: createSupabaseManagerLineups(client),
      scores: createSupabaseManagerScoreRepository(client),
    }).execute({ leagueId: id, slug });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "LEAGUE_NOT_FOUND" || error.code === "COMPETITION_NOT_FOUND") notFound();
    mine = "error";
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={mine === "error" ? text.title : mine.name}
        subtitle={text.title}
        back={{ href: `/manager/${id}/alignement`, label: messages.lineup.title }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        {mine === "error" ? (
          <ErrorNotice retryHref={path} message={messages.errors.MANAGER_SCORES_UNAVAILABLE} />
        ) : mine.score === null ? (
          <p role="status" className="rounded-card bg-muted p-4 text-sm font-semibold">
            {text.notYet}
          </p>
        ) : (
          <>
            <section
              aria-label={text.summary}
              className="rounded-card bg-nuit p-4 text-white ring-1 ring-white/10"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-white/70">
                {text.total}
              </p>
              <p className="font-display text-5xl font-extrabold leading-none">
                {text.points(mine.score.total)}
              </p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    [text.hungarian, mine.score.hungarian],
                    [text.bonus, mine.score.bonus],
                    [text.predictions, mine.score.predictions],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white/10 px-2 py-2">
                    <dt className="text-[11px] font-semibold text-white/80">{label}</dt>
                    <dd className="font-display text-xl font-extrabold">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {!mine.score.linedUp ? (
              <p role="status" className="rounded-card bg-muted p-4 text-sm font-semibold">
                {text.noLineup}
              </p>
            ) : (
              <section aria-labelledby="starters" className="flex flex-col gap-2">
                <h2
                  id="starters"
                  className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
                >
                  {text.starters}
                </h2>
                <ul aria-labelledby="starters" className="flex flex-col gap-2">
                  {mine.score.athletes.map((a) => {
                    const out = a.status !== null && a.status !== "ok";
                    return (
                      <li
                        key={a.athleteId}
                        aria-label={a.name}
                        className="flex items-start gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5"
                      >
                        <span
                          aria-hidden="true"
                          className="grid size-10 shrink-0 place-items-center rounded-full bg-nuit font-display text-sm font-extrabold text-white"
                        >
                          {athleteInitials(a.name)}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="break-words font-semibold">{a.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {text.performance(a)}
                          </span>
                          {a.bonuses.length > 0 && (
                            <span className="flex flex-wrap gap-1">
                              {a.bonuses.map((b) => (
                                <span
                                  key={b.bonus}
                                  className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold-ink"
                                >
                                  {text.bonusTag(b.bonus, b.points)}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                        <span
                          className={`shrink-0 font-display text-xl font-extrabold ${out || a.total === 0 ? "text-accent-text" : ""}`}
                        >
                          {text.athletePoints(a.total)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            <p className="text-sm text-muted-foreground">{text.help}</p>
            <Link
              href={`/manager/${id}/alignement/${slug}`}
              className="inline-flex min-h-11 items-center font-semibold text-brand dark:text-secondary"
            >
              {text.lineupLink} ›
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
