import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { comingCompetition, deleteCompetition } from "./competitions";
import { newPlayer, signUp } from "./players";

test("a double tap on « Créer la ligue » creates one league only", async ({ page }) => {
  const player = newPlayer("double");
  const competition = comingCompetition(`e2e-double-${Date.now() % 1000000}`);
  const name = `Double Tap ${Date.now() % 100000}`;

  await page.goto("/ligues");
  await signUp(page, player);
  await page.waitForURL(/\/ligues$/);
  await page.goto(`/ligues/creer?competition=${competition}`);
  // The field holds no more than a league name may have (#712).
  const field = page.getByLabel("Nom de la ligue");
  await expect(field).toHaveAttribute("maxlength", "40");
  await field.fill(name);

  // Two taps in a row: the button says it is working, and the league is created once.
  await page.getByRole("button", { name: "Créer la ligue" }).dblclick();
  await expect(page.getByText("Ta ligue est prête")).toBeVisible();
  expect(
    sql(`select count(*) from leagues l join auth.users u on u.id = l.owner_id
         where u.email = '${player.email}' and l.name = '${name}'`),
  ).toBe("1");

  deleteCompetition(competition);
});
