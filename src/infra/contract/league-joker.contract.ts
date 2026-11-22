import { describe, expect, it } from "vitest";

import type { LeagueJokerRepository } from "@/application/league-jokers";

/**
 * A league of its own with Anna and Bob, every joker, counting three open events: Anna's
 * predictions of `first` and `second` are added to the league, the one of `third` is not. Cleo is
 * not in the league. `lock` locks an event.
 */
export type LeagueJokerWorld = {
  leagueId: string;
  annaId: string;
  first: string;
  second: string;
  third: string;
  anna: LeagueJokerRepository;
  bob: LeagueJokerRepository;
  cleo: LeagueJokerRepository;
  lock: (eventId: string) => void;
};

/** Contract of the LeagueJokerRepository port (#1090), run against the in-memory fake AND Supabase. */
export function leagueJokerContract(name: string, world: () => Promise<LeagueJokerWorld>) {
  describe(`LeagueJokerRepository contract: ${name}`, () => {
    it("lists the five jokers of the prediction leagues, and only an admin turns one off", async () => {
      const w = await world();

      expect((await w.anna.catalogue("predictions")).map((j) => j.joker)).toEqual([
        "double",
        "all_or_nothing",
        "safety_net",
        "spy",
        "outsider",
      ]);
      expect(await w.anna.setActive("predictions", "double", false)).toBe("not_admin");
    });

    it("reads the jokers the league received", async () => {
      const w = await world();

      expect((await w.anna.leagueJokers(w.leagueId)).sort()).toEqual([
        "all_or_nothing",
        "double",
        "outsider",
        "safety_net",
        "spy",
      ]);
    });

    it("plays a joker once in the league, one per event", async () => {
      const w = await world();

      expect(await w.anna.play(w.leagueId, w.first, "double")).toBe("done");
      expect(await w.anna.play(w.leagueId, w.second, "double")).toBe("not_available");
      expect(await w.anna.play(w.leagueId, w.first, "safety_net")).toBe("done");
      expect(await w.anna.plays(w.leagueId)).toEqual([
        { userId: w.annaId, eventId: w.first, joker: "safety_net" },
      ]);
      expect(await w.anna.remove(w.leagueId, w.first)).toBe("done");
      expect(await w.anna.plays(w.leagueId)).toEqual([]);
    });

    it("needs the prediction added to the league, except for the spy, which stays once played", async () => {
      const w = await world();

      expect(await w.anna.play(w.leagueId, w.third, "double")).toBe("not_in_league");
      expect(await w.anna.play(w.leagueId, w.third, "spy")).toBe("done");
      expect(await w.anna.remove(w.leagueId, w.third)).toBe("spy_spent");
      expect((await w.anna.plays(w.leagueId)).map((p) => p.joker)).toEqual(["spy"]);
    });

    it("shows a joker to the other members once the event is locked, and fixes it", async () => {
      const w = await world();
      await w.anna.play(w.leagueId, w.first, "double");

      expect(await w.bob.plays(w.leagueId)).toEqual([]);
      w.lock(w.first);
      expect(await w.bob.plays(w.leagueId)).toEqual([
        { userId: w.annaId, eventId: w.first, joker: "double" },
      ]);
      expect(await w.anna.play(w.leagueId, w.first, "outsider")).toBe("locked");
      expect(await w.anna.remove(w.leagueId, w.first)).toBe("locked");
    });

    it("lets nobody outside the league play there", async () => {
      const w = await world();

      expect(await w.cleo.play(w.leagueId, w.first, "double")).toBe("not_member");
      expect(await w.cleo.leagueJokers(w.leagueId)).toEqual([]);
    });
  });
}
