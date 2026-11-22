import { UseCaseError } from "@/application/errors";
import { listJokerCatalogue, type CatalogueJoker } from "@/application/league-jokers";
import { ErrorNotice } from "@/components/error-notice";
import { isPredictionJoker, type JokerGame } from "@/domain/league-jokers";
import { isManagerJoker } from "@/domain/manager-jokers";
import { createSupabaseLeagueJokerRepository } from "@/infra";

import { messages } from "../../messages.fr";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { JokerForm } from "./joker-form";

const text = messages.leagueJokers;
const GAMES: JokerGame[] = ["predictions", "manager"];

/**
 * Back-office › Jokers (#1090): the catalogue of each game. The admin turns a joker on or off; a
 * new league receives the active ones, a league already created keeps its own.
 */
export default async function JokersPage() {
  const { client } = await adminOnly();
  let catalogue: Record<JokerGame, CatalogueJoker[]> | "error";
  try {
    const jokers = createSupabaseLeagueJokerRepository(client);
    const [predictions, manager] = await Promise.all(
      GAMES.map((game) => listJokerCatalogue({ jokers }).execute({ game })),
    );
    catalogue = { predictions: predictions!, manager: manager! };
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    catalogue = "error";
  }

  return (
    <AdminShell title={text.adminTitle} section="jokers">
      <p className="text-sm text-muted-foreground">{text.adminSubtitle}</p>
      {catalogue === "error" ? (
        <ErrorNotice retryHref="/admin/jokers" message={messages.errors.JOKERS_UNAVAILABLE} />
      ) : (
        GAMES.map((game) => (
          <section key={game} aria-labelledby={`game-${game}`} className="flex flex-col gap-2">
            <h2
              id={`game-${game}`}
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              {text.adminGame[game]}
            </h2>
            {catalogue[game].length === 0 ? (
              <p className="text-sm text-muted-foreground">{text.adminEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {catalogue[game].map(({ joker, active }) => (
                  <li key={joker} className="rounded-card border border-border bg-card p-3">
                    <JokerForm
                      game={game}
                      joker={joker}
                      name={
                        game === "predictions" && isPredictionJoker(joker)
                          ? text.name[joker]
                          : game === "manager" && isManagerJoker(joker)
                            ? messages.managerJokers.name[joker]
                            : joker
                      }
                      explain={
                        game === "predictions" && isPredictionJoker(joker)
                          ? text.explain[joker]
                          : game === "manager" && isManagerJoker(joker)
                            ? messages.managerJokers.explain[joker]
                            : null
                      }
                      active={active}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </AdminShell>
  );
}
