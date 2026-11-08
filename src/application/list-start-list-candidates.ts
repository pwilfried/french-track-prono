import type { EventGender } from "@/domain/event";

import type { Candidate, StartListRepository } from "./set-start-list";

/** The athletes the admin can put on the start list of an event of a gender, by name. */
export function listStartListCandidates(ports: { startLists: StartListRepository }) {
  return {
    async execute(input: { gender: EventGender }): Promise<Candidate[]> {
      return ports.startLists.candidates(input.gender);
    },
  };
}
