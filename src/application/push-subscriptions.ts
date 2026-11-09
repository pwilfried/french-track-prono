import { UseCaseError } from "./errors";

/** A browser's push subscription for one device (#203). */
export type PushDevice = { endpoint: string; p256dh: string; auth: string };

/** Port: the signed-in player's devices. Real adapter = Supabase, fake = in memory. */
export interface PushSubscriptionRepository {
  save(device: PushDevice): Promise<void>;
  remove(endpoint: string): Promise<void>;
}

const isPushEndpoint = (endpoint: string) => {
  try {
    return new URL(endpoint).protocol === "https:" && endpoint.length <= 1000;
  } catch {
    return false;
  }
};

/** The player turns notifications on for this device. */
export function turnOnNotifications(ports: { devices: PushSubscriptionRepository }) {
  return {
    async execute(device: PushDevice) {
      if (!isPushEndpoint(device.endpoint) || !device.p256dh || !device.auth) {
        throw new UseCaseError("NOTIFICATIONS_UNAVAILABLE");
      }
      await ports.devices.save(device);
    },
  };
}

/** The player turns them off for this device. */
export function turnOffNotifications(ports: { devices: PushSubscriptionRepository }) {
  return { execute: (input: { endpoint: string }) => ports.devices.remove(input.endpoint) };
}
