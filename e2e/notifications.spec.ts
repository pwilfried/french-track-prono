import { expect, test } from "@playwright/test";

import { messages } from "../src/app/messages.fr";
import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

const text = messages.notifications;

// The browser's push service is not reachable from the CI: the subscription is simulated, the
// rest (permission, button, server action, database) is real. The CI build has a test push key.
test("a player turns notifications on for this device, then off", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await page.addInitScript(() => {
    const KEY = "e2e.push";
    const subscription = (endpoint: string) => ({
      endpoint,
      toJSON: () => ({ endpoint, keys: { p256dh: "e2e-key", auth: "e2e-auth" } }),
      unsubscribe: async () => {
        localStorage.removeItem(KEY);
        return true;
      },
    });
    PushManager.prototype.subscribe = async function () {
      const endpoint = `https://push.example.test/${crypto.randomUUID()}`;
      localStorage.setItem(KEY, endpoint);
      return subscription(endpoint) as unknown as PushSubscription;
    };
    PushManager.prototype.getSubscription = async function () {
      const endpoint = localStorage.getItem(KEY);
      return (endpoint ? subscription(endpoint) : null) as unknown as PushSubscription | null;
    };
  });

  const player = newPlayer("push");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);
  const devices = () =>
    sql(`select count(*) from push_subscriptions s join auth.users u on u.id = s.user_id
         where u.email = '${player.email}'`);

  await page.getByRole("button", { name: text.turnOn }).click();
  await expect(page.getByRole("status").filter({ hasText: text.on })).toBeVisible();
  expect(devices()).toBe("1");

  // Still on after a reload, and turned off in one touch.
  await page.reload();
  await page.getByRole("button", { name: text.turnOff }).click();
  await expect(page.getByRole("button", { name: text.turnOn })).toBeVisible();
  expect(devices()).toBe("0");
});
