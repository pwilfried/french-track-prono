import { gameFigures, rulesFromScale, type FunFact } from "@/domain/fun-facts";

import { messages } from "./messages.fr";

/**
 * The « Le saviez-vous ? » facts about the game (#766): their figures come from scoring the
 * podiums with the scale the admin set (src/domain/scoring.ts), so they never drift from it.
 */
export function gameFunFacts(scale: Record<string, number>): FunFact[] {
  return messages.funFacts.game(gameFigures(rulesFromScale(scale))).map((fact) => ({
    ...fact,
    tag: "predictions",
    competitionSlug: null,
    discipline: null,
    startsOn: null,
    endsOn: null,
  }));
}
