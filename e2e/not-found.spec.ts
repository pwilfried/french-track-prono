import { expect, test } from "@playwright/test";

test("an unknown address answers 404 with a French page and a way home", async ({ page }) => {
  const response = await page.goto("/pronos");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  await expect(page.getByText("This page could not be found.")).toHaveCount(0);

  await page.getByRole("link", { name: "Retour à l'accueil" }).click();
  await expect(page).toHaveURL(/\/$/);
});
