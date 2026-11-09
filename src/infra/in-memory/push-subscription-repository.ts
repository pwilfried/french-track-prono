import type { PushDevice, PushSubscriptionRepository } from "@/application/push-subscriptions";

/** Test double of the PushSubscriptionRepository port: one store, a session per player. */
export function createInMemoryPushSubscriptionStore() {
  const devices = new Map<string, PushDevice & { playerId: string }>();
  return {
    endpointsOf: (playerId: string) =>
      [...devices.values()].filter((d) => d.playerId === playerId).map((d) => d.endpoint),
    session(playerId: string): PushSubscriptionRepository {
      return {
        async save(device) {
          devices.set(device.endpoint, { ...device, playerId });
        },
        async remove(endpoint) {
          if (devices.get(endpoint)?.playerId === playerId) devices.delete(endpoint);
        },
      };
    },
  };
}
