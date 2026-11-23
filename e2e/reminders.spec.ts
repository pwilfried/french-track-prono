import { expect, test } from "@playwright/test";

import { messages } from "../src/app/messages.fr";
import { newPlayer, signUp } from "./players";

const text = messages.reminders;

test("a player sets their reminders, reloads, and finds them again", async ({ page }) => {
  const player = newPlayer("remind");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);

  await page.getByRole("link", { name: messages.settings.open }).click();
  await page.waitForURL(/\/profil\/reglages$/);
  await page.getByRole("link", { name: messages.settings.reminders }).click();
  await page.waitForURL(/\/profil\/rappels$/);
  await expect(page.getByRole("heading", { name: text.title, level: 1 })).toBeVisible();

  // The defaults: every family shown is on, one hour before a lock, quiet from 23 h to 8 h.
  const manager = page.getByRole("switch", { name: text.family.manager.label });
  await expect(manager).toBeChecked();
  await expect(page.getByRole("switch", { name: text.family.league.label })).toBeChecked();
  const trashTalk = page.getByRole("switch", { name: text.family.trashTalk.label });
  await expect(trashTalk).toBeChecked();
  await expect(page.getByRole("switch")).toHaveCount(5);
  const quietFrom = page.getByRole("combobox", { name: text.quietFrom, exact: true });
  const quietTo = page.getByRole("combobox", { name: text.quietTo, exact: true });
  await expect(page.getByRole("radio", { name: "1 h" })).toBeChecked();
  await expect(quietFrom).toHaveValue("23");
  await expect(quietTo).toHaveValue("8");

  // Manager and Chambrage off, three hours before, quiet from 22 h to 7 h.
  await page.locator("label", { has: manager }).click();
  await page.locator("label", { has: trashTalk }).click();
  await page.locator("label", { has: page.getByRole("radio", { name: "3 h" }) }).click();
  await quietFrom.selectOption("22");
  await quietTo.selectOption("7");
  await page.getByRole("button", { name: text.save }).click();
  await expect(page.getByRole("status").filter({ hasText: text.saved })).toBeVisible();

  await page.reload();
  await expect(manager).not.toBeChecked();
  await expect(trashTalk).not.toBeChecked();
  await expect(page.getByRole("switch", { name: text.family.forgotten.label })).toBeChecked();
  await expect(page.getByRole("radio", { name: "3 h" })).toBeChecked();
  await expect(quietFrom).toHaveValue("22");
  await expect(quietTo).toHaveValue("7");

  // « Retour » leads back to the settings, where the player came from.
  await page.getByRole("link", { name: text.back }).click();
  await page.waitForURL(/\/profil\/reglages$/);
});
