import { expect, test } from "@playwright/test";

test("a visitor opens « Comment jouer » from the home page and reads the scale", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Comment jouer ?" }).click();

  await expect(page).toHaveURL(/\/regles$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Comment jouer");
  for (const title of ["Le podium", "Les cotes", "Les perfs", "Le joker", "Questions fréquentes"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(page.getByText(/podium parfait = 3 × \d+ \+ \d+ = \d+ points/)).toBeVisible();
});
