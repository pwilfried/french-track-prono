import { expect, test } from "@playwright/test";

test("a visitor sees the competition, the next events and reaches the full list", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prochaines épreuves" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navigation principale" }).first(),
  ).toBeAttached();

  await page.getByRole("link", { name: /^Voir les \d+ épreuves$/ }).click();
  await expect(page).toHaveURL(/\/epreuves$/);
});
