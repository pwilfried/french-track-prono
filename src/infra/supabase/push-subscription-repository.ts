import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { PushSubscriptionRepository } from "@/application/push-subscriptions";

/** The client must carry the player's session: a player only adds and removes their own devices. */
export function createSupabasePushSubscriptionRepository(
  client: SupabaseClient,
): PushSubscriptionRepository {
  return {
    async save(device) {
      const { error } = await client.rpc("save_push_subscription", {
        p_endpoint: device.endpoint,
        p_p256dh: device.p256dh,
        p_auth: device.auth,
      });
      if (error) throw new UseCaseError("NOTIFICATIONS_UNAVAILABLE");
    },

    async remove(endpoint) {
      const { error } = await client.rpc("delete_push_subscription", { p_endpoint: endpoint });
      if (error) throw new UseCaseError("NOTIFICATIONS_UNAVAILABLE");
    },
  };
}
