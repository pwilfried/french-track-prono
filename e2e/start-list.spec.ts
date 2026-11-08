import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("an admin builds the start list of a final of eight athletes in less than a minute", async ({
  page,
}) => {
  // A women's event of the competition with no start list yet, far enough not to be picked by
  // the other journeys.
  const slug = `e2e-start-list-${Date.now() % 1000000}`;
  sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, '${slug}', '100 m', 'F', now() + interval '60 days', now() + interval '59 days'
    from competitions where slug = 'ultimate-championship-2026'`);
  const player = newPlayer("depart");

  await page.goto(`/epreuves/${slug}`);
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(new RegExp(`/epreuves/${slug}$`));
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );

  const started = Date.now();
  await page.goto(`/admin/${slug}`);
  await page.getByRole("link", { name: "Liste de départ (0)" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Liste de départ");

  // Without a search, the athletes of the 100 m are offered first (#301).
  await expect(page.getByText(/^Athlètes du 100 m \(\d+\)$/)).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Athlètes trouvés" }).getByRole("button").first(),
  ).toBeVisible();

  // "ric" puts Richardson first; she joins the start list with her season best.
  const search = page.getByRole("searchbox", { name: "Rechercher un athlète" });
  const matches = page.getByRole("list", { name: "Athlètes trouvés" }).getByRole("button");
  await search.fill("ric");
  await expect(matches.first()).toContainText("Richardson");
  await matches.first().click();
  await page.getByLabel("Meilleure marque de la saison de Sha'Carri Richardson").fill("10.71");

  // Adding her twice shows a message and adds nothing.
  await matches.first().click();
  await expect(page.locator("main").getByRole("alert")).toContainText("déjà au départ");

  // Seven more athletes: without a search only the 100 m runners show, so search everybody.
  await search.fill("a");
  const chosen = page.getByRole("region", { name: /Au départ/ }).getByRole("listitem");
  for (let index = 0; (await chosen.count()) < 8; index++) {
    const match = matches.nth(index);
    if (!(await match.textContent())?.includes("Au départ")) await match.click();
  }
  await expect(chosen).toHaveCount(8);

  await page.getByRole("button", { name: "Enregistrer la liste de départ" }).click();
  await expect(page.getByRole("status")).toContainText("8 athlètes");
  expect(Date.now() - started).toBeLessThan(60_000);

  // An admin only sees the back-office: back to a player to look at the public pages.
  sql(
    `update profiles set is_admin = false where id = (select id from auth.users where email = '${player.email}')`,
  );
  // Players see the start list on the event page.
  // The loading skeleton is a second <main> for a moment: look for the name itself.
  await page.goto(`/epreuves/${slug}`);
  await expect(page.getByText("Sha'Carri Richardson").first()).toBeVisible();

  sql(`delete from events where slug = '${slug}'`);
});
