import { describe, expect, it } from "vitest";

import { createInMemoryPushSubscriptionStore } from "@/infra";

import { turnOffNotifications, turnOnNotifications } from "./push-subscriptions";

const device = { endpoint: "https://push.example.test/1", p256dh: "key", auth: "secret" };

describe("push notifications (#203)", () => {
  it("saves the device, then forgets it", async () => {
    const store = createInMemoryPushSubscriptionStore();
    await turnOnNotifications({ devices: store.session("me") }).execute(device);
    expect(store.endpointsOf("me")).toEqual([device.endpoint]);
    await turnOffNotifications({ devices: store.session("me") }).execute(device);
    expect(store.endpointsOf("me")).toEqual([]);
  });

  it("refuses something that is not a push subscription", async () => {
    const devices = createInMemoryPushSubscriptionStore().session("me");
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
