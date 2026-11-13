import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { listMyLineups, type LineupSummary } from "@/application/manager-lineup";
import { LockLine } from "@/components/countdown/lock-line";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { ChipStatus, type ChipTone } from "@/components/ui/chip-status";
import type { LineupStatus } from "@/domain/manager-lineup";
import { createSupabaseManagerLineups } from "@/infra";

import { messages } from "../../../messages.fr";
import { getSessionClient } from "../../../session";
import { managerPorts } from "../../data";

const text = messages.lineup;
const tones: Record<LineupStatus, ChipTone> = { todo: "hot", validated: "ok", locked: "neutral" };

/** The eligible competitions of a Manager league, each with where the player's lineup stands (#427). */
export default async function MyLineupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await managerPorts(`/manager/${id}/alignement`);
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
        ) : competitions.length === 0 ? (
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
