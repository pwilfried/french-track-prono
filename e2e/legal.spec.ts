import { expect, test } from "@playwright/test";

test("the legal pages are one tap away from the footer, signed in or not", async ({ page }) => {
  await page.goto("/connexion");

  await page.getByRole("contentinfo").getByRole("link", { name: "Confidentialité" }).click();
  await expect(page).toHaveURL(/\/confidentialite$/);
  await expect(page.getByRole("heading", { name: "15 ans ou plus" })).toBeVisible();

  await page.getByRole("contentinfo").getByRole("link", { name: "Mentions légales" }).click();
  await expect(page).toHaveURL(/\/mentions-legales$/);
  await expect(page.getByRole("heading", { name: "Contact" })).toBeVisible();
});
