import { describe, expect, it } from "vitest";

import type { Profile, ProfileRepository } from "@/application/create-profile";

export type Player = { userId: string; profiles: ProfileRepository };

/**
 * Contract of the ProfileRepository port, run against the in-memory fake AND the real Supabase adapter.
 * `newPlayer()` gives a new signed-in player: the real database only accepts a profile
 * written by the player it belongs to.
 */
export function profileRepositoryContract(name: string, newPlayer: () => Promise<Player>) {
  const pseudo = () => `Joueur ${crypto.randomUUID().slice(0, 8)}`;
  const profileOf = (player: Player, name = pseudo()): Profile => ({
    userId: player.userId,
    pseudo: name,
    avatar: "🦅",
    ageConfirmedAt: new Date("2026-11-06T12:00:00.000Z"),
  });

  describe(`ProfileRepository contract: ${name}`, () => {
    it("does not take a new player for an admin", async () => {
      const player = await newPlayer();
      await player.profiles.create(profileOf(player));

      expect(await player.profiles.isAdmin(player.userId)).toBe(false);
    });

    it("finds nothing for a player without profile", async () => {
      const player = await newPlayer();

      expect(await player.profiles.find(player.userId)).toBeNull();
    });

    it("finds the profile that was created", async () => {
      const player = await newPlayer();
      const profile = profileOf(player);

      expect(await player.profiles.create(profile)).toBe("created");

      expect(await player.profiles.find(player.userId)).toEqual(profile);
    });

    it("refuses a pseudo taken by another player, whatever the case", async () => {
      const first = await newPlayer();
      const second = await newPlayer();
      const taken = pseudo();
      await first.profiles.create(profileOf(first, taken));

      expect(await second.profiles.create(profileOf(second, taken.toUpperCase()))).toBe(
        "pseudo_taken",
      );
      expect(await second.profiles.find(second.userId)).toBeNull();
    });

    it("refuses a second profile for the same player", async () => {
      const player = await newPlayer();
      await player.profiles.create(profileOf(player));

      expect(await player.profiles.create(profileOf(player))).toBe("profile_exists");
    });
  });
}
