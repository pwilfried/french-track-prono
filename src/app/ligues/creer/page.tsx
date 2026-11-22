import { UseCaseError } from "@/application/errors";
import { listNewLeagueJokers } from "@/application/league-jokers";
import { CreateLeagueForm } from "@/components/leagues/league-forms";
import { JokerList } from "@/components/leagues/league-jokers";
import { LeagueHero } from "@/components/leagues/league-hero";
import { isOpenToLeagues } from "@/domain/league";
import { isPredictionJoker, type PredictionJoker } from "@/domain/league-jokers";
import { pickableFromDays } from "@/domain/season-picker";

import { loadCompetitions } from "../../competition";
import { paramList } from "../../search-params";
import { messages } from "../../messages.fr";
import { leaguePorts } from "../data";

/** The jokers the new league will receive (#1090); null when they cannot be read. */
async function loadNewLeagueJokers(
  ports: Awaited<ReturnType<typeof leaguePorts>>,
): Promise<PredictionJoker[] | null> {
  try {
    const jokers = await listNewLeagueJokers(ports).execute({ game: "predictions" });
    return jokers.filter(isPredictionJoker);
  } catch (error) {
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}

/**
 * League creation: its name, its families and its competitions, ticked in the season picker of the
 * Manager (#721), the ones given in the address (`competition`) ticked from the start. Only the
 * competitions not finished are offered (#614).
 */
export default async function CreateLeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string | string[]; publique?: string }>;
}) {
  const params = await searchParams;
  const asked = [...new Set(paramList(params.competition))];
  const ports = await leaguePorts(
    asked.length
      ? `/ligues/creer?${new URLSearchParams(asked.map((slug) => ["competition", slug]))}`
      : "/ligues/creer",
  );
  const [{ coming }, jokers] = await Promise.all([loadCompetitions(), loadNewLeagueJokers(ports)]);
  const now = new Date().toISOString();
  const competitions = coming.filter((c) => isOpenToLeagues(c, now)).map(pickableFromDays);
  const chosen = competitions.filter((c) => asked.includes(c.id)).map((c) => c.id);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={messages.leagues.createTitle}
        subtitle={messages.leagues.createSubtitle}
        back={{ href: "/ligues", label: messages.leagues.back }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
        <CreateLeagueForm
          competitions={competitions}
          chosen={chosen}
          isPublic={params.publique === "1"}
        />
        {jokers && (
          <section aria-labelledby="league-jokers" className="flex flex-col gap-2">
            <h2 id="league-jokers" className="font-display text-xl font-extrabold">
              {messages.leagueJokers.createTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{messages.leagueJokers.createText}</p>
            <JokerList jokers={jokers} />
          </section>
        )}
      </div>
    </main>
  );
}
