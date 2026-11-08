import type { EventGender } from "@/domain/event";
import { MAX_START_LIST } from "@/domain/start-list";
import { athleteSlug } from "@/domain/start-list-import";

import { UseCaseError } from "./errors";
import { setStartList, type StartListRepository } from "./set-start-list";

/** One line the admin confirmed: a known athlete, or one to add. */
export type ImportEntry =
  | { athleteId: string; seasonBest: string | null }
  | { newAthlete: { name: string; countryCode: string }; seasonBest: string | null };

/**
 * Applies a pasted start list: adds the athletes unknown so far, then replaces the start list of
 * the event (same rules as entering it by hand).
 */
export function importStartList(ports: { startLists: StartListRepository }) {
  return {
    async execute(input: { eventId: string; gender: EventGender; entries: ImportEntry[] }) {
      const known = input.entries.flatMap((e) => ("athleteId" in e ? [e.athleteId] : []));
      // Checked before adding anyone, so a refusal leaves no new athlete behind.
      if (
        input.entries.length === 0 ||
        input.entries.length > MAX_START_LIST ||
        new Set(known).size !== known.length
      ) {
        throw new UseCaseError("START_LIST_INVALID");
      }
      const toCreate = input.entries.flatMap((e) => ("newAthlete" in e ? [e.newAthlete] : []));
      if (toCreate.some((a) => !/^[A-Za-z]{3}$/.test(a.countryCode.trim()) || !a.name.trim())) {
        throw new UseCaseError("IMPORT_COUNTRY_MISSING");
      }
      const entries = [];
      for (const entry of input.entries) {
        if (!("newAthlete" in entry)) {
          entries.push(entry);
          continue;
        }
        const name = entry.newAthlete.name.trim();
        const created = await ports.startLists.createAthlete({
          name,
          countryCode: entry.newAthlete.countryCode.trim().toUpperCase(),
          gender: input.gender,
          slug: athleteSlug(name),
        });
        if (created === "not_admin") throw new UseCaseError("NOT_ADMIN");
        entries.push({ athleteId: created.athleteId, seasonBest: entry.seasonBest });
      }
      return setStartList(ports).execute({ eventId: input.eventId, entries });
    },
  };
}
