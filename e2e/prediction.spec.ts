import { expect, test } from "@playwright/test";

import { latestCodeFromMailbox } from "../src/infra/contract/mailbox";
import { sql } from "./database";

test("a new player predicts a podium, then cannot change it once the event is locked", async ({
  page,
}) => {
  // An event still open (run `npm run db:open-events` first).
  const slug = sql(
    "select slug from events where lock_at > now() + interval '5 minutes' order by starts_at limit 1",
  );
  expect(slug, "no open event: run npm run db:open-events").not.toBe("");
  const email = `e2e-${Date.now()}@example.test`;

  // Visitor on the event: the sign-in prompt comes back to it.
  await page.goto(`/epreuves/${slug}`);
  await page.getByRole("link", { name: "Se connecter", exact: true }).last().click();
  await page.getByLabel("Ton e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await page.getByLabel(/code/i).fill(await latestCodeFromMailbox(email));
  await page.getByRole("button", { name: "Me connecter" }).click();

  // First visit: profile.
  await page.waitForURL(/\/bienvenue/);
  await page.getByLabel("Ton pseudo").fill(`E2E ${Date.now() % 100000}`);
  await page.locator("label", { hasText: "🦅" }).click();
  await page.getByRole("checkbox", { name: /15 ans/ }).check();
  await page.getByRole("button", { name: "Créer mon profil" }).click();
  await page.waitForURL(new RegExp(`/epreuves/${slug}$`));

  // Compose the podium with the first three athletes, then save.
  const athletes = page.locator("li > button[aria-pressed]");
  for (const index of [0, 1, 2]) await athletes.nth(index).click();
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.getByRole("status")).toContainText("Podium enregistré");

  // Reopening the page shows the saved podium.
  await page.reload();
  await expect(page.getByRole("button", { name: /^1re place : (?!vide)/ })).toBeVisible();

  // The event locks; saving again is refused.
  sql(`update events set lock_at = now() - interval '1 second' where slug = '${slug}'`);
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Trop tard");
});
