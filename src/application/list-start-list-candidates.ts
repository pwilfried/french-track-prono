import type { EventGender } from "@/domain/event";
import { sortByDiscipline } from "@/domain/start-list";

import type { Candidate, StartListRepository } from "./set-start-list";

/**
 * The athletes the admin can put on the start list of an event: its gender, those who run its
 * discipline first (main discipline before the others).
 */
export function listStartListCandidates(ports: { startLists: StartListRepository }) {
  return {
    async execute(input: {
      gender: EventGender;
      discipline: string;
      eventId: string;
    }): Promise<Candidate[]> {
      return sortByDiscipline(
        await ports.startLists.candidates(input.gender, input.discipline, input.eventId),
      );
    },
  };
}
