import { describe, expect, it } from "vitest";

import type { PushSubscriptionRepository } from "@/application/push-subscriptions";

export type PushSubscriptionWorld = {
  player: PushSubscriptionRepository;
  other: PushSubscriptionRepository;
  /** The devices stored for the player and for the other player. */
  endpoints(): Promise<{ player: string[]; other: string[] }>;
};

/** Contract of the PushSubscriptionRepository port (#203), run against the fake AND Supabase. */
export function pushSubscriptionContract(
  name: string,
  world: () => Promise<PushSubscriptionWorld>,
) {
  describe(`PushSubscriptionRepository contract: ${name}`, () => {
    it("keeps a device per player, removed only by its owner", async () => {
      const w = await world();
      const endpoint = `https://push.example.test/${crypto.randomUUID()}`;
      await w.player.save({ endpoint, p256dh: "key", auth: "secret" });
      expect(await w.endpoints()).toEqual({ player: [endpoint], other: [] });

      await w.other.remove(endpoint);
      expect((await w.endpoints()).player).toEqual([endpoint]);

      await w.player.remove(endpoint);
      expect(await w.endpoints()).toEqual({ player: [], other: [] });
    });

    it("moves a shared device to whoever turned notifications on last", async () => {
      const w = await world();
      const endpoint = `https://push.example.test/${crypto.randomUUID()}`;
      await w.player.save({ endpoint, p256dh: "key", auth: "secret" });
      await w.other.save({ endpoint, p256dh: "key", auth: "secret" });
      expect(await w.endpoints()).toEqual({ player: [], other: [endpoint] });
    });
  });
}
