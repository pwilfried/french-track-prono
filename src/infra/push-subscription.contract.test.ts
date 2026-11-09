import { describe, it } from "vitest";

import { sql } from "./contract/database";
import { pushSubscriptionContract } from "./contract/push-subscription.contract";
import { signedInPlayer } from "./contract/test-player";
import {
  createInMemoryPushSubscriptionStore,
  createSupabasePushSubscriptionRepository,
} from "./index";

pushSubscriptionContract("in-memory fake", async () => {
  const store = createInMemoryPushSubscriptionStore();
  return {
    player: store.session("me"),
    other: store.session("other"),
    endpoints: async () => ({ player: store.endpointsOf("me"), other: store.endpointsOf("other") }),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  pushSubscriptionContract("Supabase (local)", async () => {
    const [player, other] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    const of = (userId: string) =>
      sql(
        `select coalesce(string_agg(endpoint, ' '), '') from push_subscriptions where user_id = '${userId}'`,
      )
        .split(" ")
        .filter(Boolean);
    return {
      player: createSupabasePushSubscriptionRepository(player.client),
      other: createSupabasePushSubscriptionRepository(other.client),
      endpoints: async () => ({ player: of(player.userId), other: of(other.userId) }),
    };
  });
} else {
  describe("Supabase push subscription repository", () => {
    const message = "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set";
    if (process.env.REQUIRE_SUPABASE_TESTS) {
      it("has a local Supabase configured", () => {
        throw new Error(message);
      });
    } else {
      it.skip(`is skipped: ${message}`, () => {});
    }
  });
}
