import { expect, test } from "@playwright/test";

import { messages } from "../src/app/messages.fr";
import { onPreprod, sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

// Headless Chromium denies notifications and cannot reach a push service: the permission and the
// subscription are simulated, the rest (button, server action, database) is real. The CI build
// has a test push key.
test("a player turns notifications on for this device, then off", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "granted" });
    Notification.requestPermission = async () => "granted";
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
  await page.getByRole("link", { name: messages.settings.open }).click();
  await page.waitForURL(/\/profil\/reglages$/);
  // A build without a push key shows no notifications switch: pre-production has none (#830).
  const toggle = page.getByRole("switch", { name: messages.settings.phone });
  test.skip(
    onPreprod() && (await toggle.count()) === 0,
    "no NEXT_PUBLIC_VAPID_PUBLIC_KEY in this pre-production build",
  );
  const devices = () =>
    sql(`select count(*) from push_subscriptions s join auth.users u on u.id = s.user_id
         where u.email = '${player.email}'`);

  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  expect(devices()).toBe("1");

  // Still on after a reload, and turned off in one touch.
  await page.reload();
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  expect(devices()).toBe("0");
});
