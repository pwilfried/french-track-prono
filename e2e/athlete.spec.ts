import { expect, test } from "@playwright/test";

test("a visitor opens an athlete from an event, reads their records and comes back", async ({
  page,
}) => {
  await page.goto("/epreuves/f-100m");
  await page.getByRole("link", { name: "Sha'Carri Richardson" }).first().click();

  await expect(page).toHaveURL(/\/athletes\/sha-carri-richardson\?from=/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sha'Carri Richardson");
  // Records only (#679): the seed's result gave her a personal best in the 100 m.
  const records = page.getByRole("region", { name: "Records" });
  await expect(records.getByRole("heading", { name: "100 m" })).toBeVisible();
  await expect(records.getByText("Record personnel").first()).toBeVisible();
  await expect(records).toContainText(/\d+\.\d{2}/);
  await expect(records).toContainText("Source : World Athletics");
  await expect(page.getByText("Dernières épreuves")).toHaveCount(0);

  await page.getByRole("link", { name: "‹ Mon podium" }).click();
  await expect(page).toHaveURL(/\/epreuves\/f-100m(#podium)?$/);
});

test("an unknown athlete gives the not-found page", async ({ page }) => {
  const response = await page.goto("/athletes/no-such-athlete");
  expect(response?.status()).toBe(404);
});
