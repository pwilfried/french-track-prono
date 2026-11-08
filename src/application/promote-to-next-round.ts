import { UseCaseError } from "./errors";
import type { StartListRepository } from "./set-start-list";

/** The admin qualifies the first of a heat or semi-final for the next round. */
export function promoteToNextRound(ports: { startLists: StartListRepository }) {
  return {
    async execute(input: { eventId: string; top: number }): Promise<number> {
      if (!Number.isInteger(input.top) || input.top < 1 || input.top > 24) {
        throw new UseCaseError("START_LIST_INVALID");
      }
      const outcome = await ports.startLists.promote(input.eventId, input.top);
      if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
      if (outcome === "no_next_round") throw new UseCaseError("ROUND_UNAVAILABLE");
      return outcome;
    },
  };
}
