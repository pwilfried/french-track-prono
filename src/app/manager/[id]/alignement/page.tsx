import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getManagerLeague } from "@/application/manager-leagues";
import {
  getFirstLineupGuide,
  listMyLineups,
  type FirstLineupGuide,
  type LineupSummary,
} from "@/application/manager-lineup";
import { FirstLineupCard } from "@/components/manager/first-lineup-card";
import { LockLine } from "@/components/countdown/lock-line";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { ChipStatus, type ChipTone } from "@/components/ui/chip-status";
import type { LineupStatus } from "@/domain/manager-lineup";
import {
  createSupabaseManagerBids,
  createSupabaseManagerCatalogue,
  createSupabaseManagerLineups,
} from "@/infra";

import { messages } from "../../../messages.fr";
import { getSessionClient } from "../../../session";
import { managerPorts } from "../../data";

const text = messages.lineup;
const tones: Record<LineupStatus, ChipTone> = { todo: "hot", validated: "ok", locked: "neutral" };

/** The eligible competitions of a Manager league, each with where the player's lineup stands (#427). */
export default async function MyLineupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ports = await managerPorts(`/manager/${id}/alignement`);
  let competitions: LineupSummary[] | "error";
  try {
    competitions = await listMyLineups({
      lineups: createSupabaseManagerLineups(await getSessionClient()),
    }).execute({ leagueId: id, now: new Date().toISOString() });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "LEAGUE_NOT_FOUND") notFound();
    competitions = "error";
  }

  // The guide of a player who never validated a lineup here; a failure only hides it (#1037).
  let guide: { steps: FirstLineupGuide; rulesLines: string[] } | null = null;
  if (competitions !== "error") {
    try {
      const client = await getSessionClient();
      const now = new Date().toISOString();
      const [steps, league] = await Promise.all([
        getFirstLineupGuide({
          managerLeagues: ports.managerLeagues,
          bids: createSupabaseManagerBids(client),
          catalogue: createSupabaseManagerCatalogue(client),
          lineups: createSupabaseManagerLineups(client),
        }).execute({ leagueId: id, now }),
        getManagerLeague(ports).execute({ id }),
      ]);
      if (steps) {
        guide = {
          steps,
          rulesLines: text.first.rulesLines(steps.divisor, league.rules.bonuses.first),
        };
      }
    } catch (error) {
      if (!(error instanceof UseCaseError)) throw error;
    }
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={text.title}
        subtitle={text.subtitle}
        back={{ href: `/manager/${id}`, label: messages.manager.back }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6">
        {competitions === "error" ? (
          <ErrorNotice
            retryHref={`/manager/${id}/alignement`}
            message={messages.errors.LINEUPS_UNAVAILABLE}
          />
        ) : null}
        {guide && (
          <FirstLineupCard
            done={guide.steps.done}
            current={guide.steps.current}
            href={`/manager/${id}/alignement/${guide.steps.slug}`}
            rulesLines={guide.rulesLines}
          />
        )}
        {competitions === "error" ? null : competitions.length === 0 ? (
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
            {text.noCompetition}
          </p>
        ) : (
          <section aria-labelledby="competitions" className="flex flex-col gap-2">
            <h2
              id="competitions"
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {text.competitions}
            </h2>
            <ul aria-labelledby="competitions" className="flex flex-col gap-2">
              {competitions.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/manager/${id}/alignement/${c.slug}`}
                    className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="break-words font-semibold">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        <LockLine lockAt={c.lockAt} />
                      </span>
                    </span>
                    <ChipStatus tone={tones[c.status]}>{text.status[c.status]}</ChipStatus>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
