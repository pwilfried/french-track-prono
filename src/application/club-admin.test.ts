import { describe, expect, it } from "vitest";

import {
  deleteClub,
  mergeClub,
  listAdminClubs,
  saveClub,
  validateClub,
  type AdminClub,
  type ClubAdminRepository,
} from "./club-admin";
import { UseCaseError } from "./errors";

// Application tests do not import the infra layer: a few lines of fake are enough here.
function fakeClubs(isAdmin = true) {
  const all: AdminClub[] = [
    {
      id: "c1",
      name: "Foulées de Sceaux",
      city: "Sceaux",
      department: "92",
      source: "player",
      validated: false,
      playerCount: 1,
      createdAt: "2026-11-08T10:00:00.000Z",
    },
  ];
  const clubs: ClubAdminRepository = {
    async list(query, pendingOnly) {
      if (!isAdmin) return "not_admin";
      return all.filter(
        (c) => (!pendingOnly || !c.validated) && c.name.toLowerCase().includes(query.toLowerCase()),
      );
    },
    async save(id, club) {
      if (!isAdmin) return "not_admin";
      if (id === null) {
        all.push({
          ...club,
          id: `c${all.length + 1}`,
          source: "admin",
          validated: true,
          playerCount: 0,
          createdAt: "2026-11-09T10:00:00.000Z",
        });
        return `c${all.length}`;
      }
      const found = all.find((c) => c.id === id);
      if (!found) return "unknown";
      Object.assign(found, club);
      return id;
    },
    async validate(id) {
      const found = all.find((c) => c.id === id);
      if (!found) return "unknown";
      found.validated = true;
      return "done";
    },
    async remove(id) {
      const index = all.findIndex((c) => c.id === id);
      if (index < 0) return "unknown";
      all.splice(index, 1);
      return "done";
    },
    async merge(fromId, intoId) {
      if (!isAdmin) return "not_admin";
      if (fromId === intoId) return "same";
      const from = all.find((c) => c.id === fromId);
      const into = all.find((c) => c.id === intoId);
      if (!from || !into) return "unknown";
      into.playerCount += from.playerCount;
      all.splice(all.indexOf(from), 1);
      return from.playerCount;
    },
  };
  return { clubs, all };
}

describe("the admin manages clubs", () => {
  it("validates a club a player typed, then renames it", async () => {
    // given a club typed by a player
    const world = fakeClubs();
    const pending = await listAdminClubs(world).execute({ query: "", pendingOnly: true });
    expect(pending.map((c) => c.name)).toEqual(["Foulées de Sceaux"]);
    // when the admin validates it and fixes its name
    await validateClub(world).execute({ id: "c1" });
    await saveClub(world).execute({
      id: "c1",
      name: "  AS  Sceaux ",
      city: "Sceaux",
      department: "92",
    });
    // then it is validated with the new name
    expect(world.all[0]).toMatchObject({ name: "AS Sceaux", validated: true });
  });

  it("creates and deletes a club", async () => {
    const world = fakeClubs();
    const id = await saveClub(world).execute({
      id: null,
      name: "Stade Nouveau",
      city: "Ici",
      department: "13",
    });
    await deleteClub(world).execute({ id });
    expect(world.all.map((c) => c.id)).toEqual(["c1"]);
  });

  it.each([
    [{ name: "x" }, "CLUB_NAME_INVALID"],
    [{ name: "Club Officiel FFA" }, "CLUB_NAME_BANNED"],
    [{ id: "gone" }, "CLUB_UNKNOWN"],
  ])("refuses %j with %s", async (change, code) => {
    await expect(
      saveClub(fakeClubs()).execute({
        id: "c1",
        name: "AS Sceaux",
        city: "",
        department: "",
        ...change,
      }),
    ).rejects.toEqual(new UseCaseError(code as never));
  });

  it("refuses a player who is not admin", async () => {
    await expect(
      listAdminClubs(fakeClubs(false)).execute({ query: "", pendingOnly: false }),
    ).rejects.toEqual(new UseCaseError("NOT_ADMIN"));
  });

  it("merges a duplicate into the right club, its players with it", async () => {
    // given a club a player typed and the imported club it duplicates
    const world = fakeClubs();
    const right = await saveClub(world).execute({
      id: null,
      name: "Étoile de Sceaux",
      city: "Sceaux",
      department: "92",
    });
    // when the admin merges the duplicate into it
    const moved = await mergeClub(world).execute({ fromId: "c1", intoId: right });
    // then its player moved over and the duplicate is gone
    expect(moved).toBe(1);
    expect(world.all.map((c) => [c.id, c.playerCount])).toEqual([[right, 1]]);
  });

  it("refuses to merge a club into itself or into an unknown club", async () => {
    const world = fakeClubs();
    await expect(mergeClub(world).execute({ fromId: "c1", intoId: "c1" })).rejects.toThrow(
      new UseCaseError("CLUB_MERGE_SAME"),
    );
    await expect(mergeClub(world).execute({ fromId: "c1", intoId: "zz" })).rejects.toThrow(
      new UseCaseError("CLUB_UNKNOWN"),
    );
  });
});
