import { validateClubName } from "@/domain/player-details";

import { UseCaseError } from "./errors";

/** A club as the admin sees it in the back-office « Clubs » (#366). */
export type AdminClub = {
  id: string;
  name: string;
  city: string;
  department: string;
  source: "import" | "player" | "admin";
  validated: boolean;
  playerCount: number;
};

export type ClubFields = { name: string; city: string; department: string };

/**
 * Port: the admin's management of clubs. Real adapter = Supabase (the database checks the admin
 * and logs each action), fake = in memory.
 */
export interface ClubAdminRepository {
  /** Clubs whose name or town contains the query, those to validate first, 50 at most. */
  list(query: string, pendingOnly: boolean): Promise<AdminClub[] | "not_admin">;
  /** Creates (id null) or edits a club; returns its id. */
  save(id: string | null, club: ClubFields): Promise<string | "not_admin" | "unknown" | "banned">;
  validate(id: string): Promise<"done" | "not_admin" | "unknown">;
  /** Deletes a club; its players simply have no club any more. */
  remove(id: string): Promise<"done" | "not_admin" | "unknown">;
}

type Ports = { clubs: ClubAdminRepository };

const check = (outcome: string) => {
  if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
  if (outcome === "unknown") throw new UseCaseError("CLUB_UNKNOWN");
  if (outcome === "banned") throw new UseCaseError("CLUB_NAME_BANNED");
};

export function listAdminClubs(ports: Ports) {
  return {
    async execute(input: { query: string; pendingOnly: boolean }): Promise<AdminClub[]> {
      const clubs = await ports.clubs.list(input.query.trim().slice(0, 80), input.pendingOnly);
      if (clubs === "not_admin") throw new UseCaseError("NOT_ADMIN");
      return clubs;
    },
  };
}

export function saveClub(ports: Ports) {
  return {
    async execute(input: { id: string | null } & ClubFields): Promise<string> {
      const name = validateClubName(input.name);
      if (!name.ok) throw new UseCaseError(name.code);
      const city = input.city.replace(/\s+/g, " ").trim();
      if (city.length > 80) throw new UseCaseError("CLUB_NAME_INVALID");
      const outcome = await ports.clubs.save(input.id || null, {
        name: name.name,
        city,
        department: input.department.trim().slice(0, 3),
      });
      check(outcome);
      return outcome;
    },
  };
}

export function validateClub(ports: Ports) {
  return {
    async execute(input: { id: string }): Promise<void> {
      check(await ports.clubs.validate(input.id));
    },
  };
}

export function deleteClub(ports: Ports) {
  return {
    async execute(input: { id: string }): Promise<void> {
      check(await ports.clubs.remove(input.id));
    },
  };
}
