import { expect, test } from "@playwright/test";

test("a visitor opens an athlete from a start list and sees a PR and a recent race", async ({
  page,
}) => {
  await page.goto("/epreuves/f-100m");
  await page.getByRole("link", { name: "Sha'Carri Richardson" }).click();

  await expect(page).toHaveURL(/\/athletes\/sha-carri-richardson$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sha'Carri Richardson");
  const records = page.getByRole("region", { name: "Records" });
  await expect(records.getByText("Record perso").first()).toBeVisible();
  await expect(records.getByText(/^\d+\.\d{2}$/).first()).toBeVisible();
  const races = page.getByRole("region", { name: "Dernières courses" }).getByRole("listitem");
  await expect(races.first()).toContainText("100 m");
});

test("an unknown athlete gives the not-found page", async ({ page }) => {
  const response = await page.goto("/athletes/no-such-athlete");
  expect(response?.status()).toBe(404);
});
