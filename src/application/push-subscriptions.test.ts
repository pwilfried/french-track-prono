import { describe, expect, it } from "vitest";

import {
  type PushSubscriptionRepository,
  turnOffNotifications,
  turnOnNotifications,
} from "./push-subscriptions";

function devicesOf(endpoints: string[]): PushSubscriptionRepository {
  return {
    save: async (device) => void endpoints.push(device.endpoint),
    remove: async (endpoint) => void endpoints.splice(endpoints.indexOf(endpoint), 1),
  };
}

const device = { endpoint: "https://push.example.test/1", p256dh: "key", auth: "secret" };

describe("push notifications (#203)", () => {
  it("saves the device, then forgets it", async () => {
    const endpoints: string[] = [];
    await turnOnNotifications({ devices: devicesOf(endpoints) }).execute(device);
    expect(endpoints).toEqual([device.endpoint]);
    await turnOffNotifications({ devices: devicesOf(endpoints) }).execute(device);
    expect(endpoints).toEqual([]);
  });

  it("refuses something that is not a push subscription", async () => {
    const devices = devicesOf([]);
    for (const bad of [
      { ...device, endpoint: "http://push.example.test" },
      { ...device, auth: "" },
    ]) {
      await expect(turnOnNotifications({ devices }).execute(bad)).rejects.toMatchObject({
        code: "NOTIFICATIONS_UNAVAILABLE",
      });
    }
  });
});
