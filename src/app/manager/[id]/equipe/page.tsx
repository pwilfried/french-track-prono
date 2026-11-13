import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getMyManagerTeam, type MyManagerTeam } from "@/application/manager-team";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { AthleteCard } from "@/components/manager/athlete-card";
import { CARD_GROUPS, cardGroupOf } from "@/domain/manager-team";
import { createSupabaseManagerBids, createSupabaseManagerCatalogue } from "@/infra";

import { messages } from "../../../messages.fr";
import { getSessionClient } from "../../../session";
import { managerPorts } from "../../data";

const text = messages.team;

/** A figure of the night-blue summary. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-semibold opacity-80">{label}</dt>
      <dd className="font-mono text-2xl font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * The player's Manager team (#426): a summary (athletes, credits spent and left), then the athletes
 * as cards, by family. Fixed for the season once the mercato is closed: nothing to buy, sell or
 * swap in v1. An incomplete team reads why, and that it plays all the same.
 */
export default async function MyTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ports = await managerPorts(`/manager/${id}/equipe`);
  const client = await getSessionClient();
  let team: MyManagerTeam | "error";
  try {
    team = await getMyManagerTeam({
      managerLeagues: ports.managerLeagues,
      bids: createSupabaseManagerBids(client),
      catalogue: createSupabaseManagerCatalogue(client),
    }).execute({ leagueId: id });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "LEAGUE_NOT_FOUND") notFound();
    team = "error";
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={text.title}
        subtitle={text.subtitle}
        back={{ href: `/manager/${id}`, label: messages.manager.back }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6 md:max-w-3xl">
        {team === "error" ? (
          <ErrorNotice
            retryHref={`/manager/${id}/equipe`}
            message={messages.errors.MANAGER_BIDS_UNAVAILABLE}
          />
        ) : (
          <>
            <section
              aria-labelledby="team-summary"
              className="hero flex flex-col gap-3 rounded-card p-4"
            >
              <h2 id="team-summary" className="sr-only">
                {text.summary}
              </h2>
              <dl className="grid grid-cols-3 gap-3">
                <Figure label={text.athletes} value={text.count(team.athletes.length)} />
                <Figure label={text.spent} value={messages.catalogue.price(team.spent)} />
                <Figure label={text.left} value={messages.catalogue.price(team.left)} />
              </dl>
              <p className="text-sm font-semibold">
                {team.mercatoClosed ? `🔒 ${text.fixed}` : text.notFixed}
              </p>
            </section>

            {team.mercatoClosed && team.athletes.length < team.minTeamSize && (
              <p role="status" className="rounded-card bg-muted p-4 text-sm font-semibold">
                {text.short(
                  team.athletes.length,
                  team.minTeamSize,
                  team.unmet.map((q) => text.nobody[q.sex][q.family]),
                )}
              </p>
            )}

            {team.athletes.length === 0 ? (
              <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
                {text.empty}
              </p>
            ) : (
              CARD_GROUPS.map((group) => {
                const athletes = team.athletes.filter((a) => cardGroupOf(a.family) === group);
                if (athletes.length === 0) return null;
                return (
                  <section
                    key={group}
                    aria-labelledby={`group-${group}`}
                    className="flex flex-col gap-2"
                  >
                    <h2
                      id={`group-${group}`}
                      className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
                    >
                      {text.groups[group]}
                    </h2>
                    <ul
                      aria-labelledby={`group-${group}`}
                      className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6"
                    >
                      {athletes.map((a) => (
                        <li key={a.athleteId}>
                          <AthleteCard athlete={a} paid={a.paid} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </>
        )}
      </div>
    </main>
  );
}
