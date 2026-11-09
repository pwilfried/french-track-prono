import { describe, expect, it } from "vitest";

import type { ClubDirectory } from "@/application/clubs";
import type { PlayerDetailsRepository } from "@/application/player-details";

export type PlayerDetailsWorld = {
  userId: string;
  /** The signed-in player's view. */
  clubs: ClubDirectory;
  details: PlayerDetailsRepository;
  /** Adds an imported (validated) club and returns its id. */
  importClub(name: string): Promise<string>;
  /** Another player's view, to check privacy. */
  other: { userId: string; clubs: ClubDirectory; details: PlayerDetailsRepository };
};

const tag = () =>
  `Zp${crypto
    .randomUUID()
    .slice(0, 6)
    .replace(/[^a-z]/g, "x")}`;

/** Contract of the PlayerDetailsRepository port and ClubDirectory.propose (#340). */
export function playerDetailsContract(name: string, world: () => Promise<PlayerDetailsWorld>) {
  describe(`PlayerDetailsRepository contract: ${name}`, () => {
    it("starts empty", async () => {
      const w = await world();
      expect(await w.details.find(w.userId)).toEqual({ sex: null, disciplines: [], club: null });
    });

    it("saves sex, disciplines and an imported club", async () => {
      const w = await world();
      const club = `Athlé ${tag()}`;
      const clubId = await w.importClub(club);

      expect(
        await w.details.save(w.userId, { sex: "F", disciplines: ["100 m", "200 m"], clubId }),
      ).toBe("saved");

      const found = await w.details.find(w.userId);
      expect(found.sex).toBe("F");
      expect([...found.disciplines].sort()).toEqual(["100 m", "200 m"]);
      expect(found.club).toMatchObject({ id: clubId, name: club, validated: true });
    });

    it("saves a club the player typed, once, hidden from the search", async () => {
      const w = await world();
      const club = `Foulées ${tag()}`;
      const first = await w.clubs.propose(club, "Nulle-Part");
      const again = await w.clubs.propose(club.toUpperCase(), "nulle part");
      expect(first !== "banned" && again !== "banned" && again.id === first.id).toBe(true);
      if (first === "banned") return;

      expect(await w.details.save(w.userId, { sex: null, disciplines: [], clubId: first.id })).toBe(
        "saved",
      );
      expect((await w.details.find(w.userId)).club).toMatchObject({
        id: first.id,
        validated: false,
      });
      expect(await w.clubs.search(club, 20)).toEqual([]);
      expect(
        await w.other.details.save(w.other.userId, {
          sex: null,
          disciplines: [],
          clubId: first.id,
        }),
      ).toBe("unknown_club");
    });

    it("refuses a club with banned words", async () => {
      const w = await world();
      expect(await w.clubs.propose("Club Officiel FFA", "")).toBe("banned");
    });

    it("keeps sex and disciplines private", async () => {
      const w = await world();
      await w.details.save(w.userId, { sex: "M", disciplines: ["400 m"], clubId: null });
      expect(await w.other.details.find(w.userId)).toEqual({
        sex: null,
        disciplines: [],
        club: null,
      });
    });
  });
}
