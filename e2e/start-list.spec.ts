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
  // An empty start list shows one neutral line, never the old test-data notice (#803).
  await expect(page.getByText("La liste de départ n'est pas encore connue.")).toBeVisible();
  await expect(page.getByText(/jeu de test/)).toHaveCount(0);
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

  // Every other 100 m runner, from the list offered without a search (#307: only them).
  await search.fill("");
  const offered = await matches.count();
  for (let index = 0; index < offered; index++) {
    const match = matches.nth(index);
    if (!(await match.textContent())?.includes("Au départ")) await match.click();
  }
  const chosen = page.getByRole("region", { name: /Au départ/ }).getByRole("listitem");
  await expect(chosen).toHaveCount(offered);
  // A man is never offered on a women's event, even when searched for.
  await search.fill("Bednarek");
  await expect(page.getByText("Aucun athlète ne correspond.")).toBeVisible();

  await page.getByRole("button", { name: "Enregistrer la liste de départ" }).click();
  await expect(page.getByRole("status")).toContainText(`${offered} athlète`);
  expect(Date.now() - started).toBeLessThan(60_000);

  // Back to a player to look at the public pages as they see them.
  sql(
    `update profiles set is_admin = false where id = (select id from auth.users where email = '${player.email}')`,
  );
  // Players see the start list on the event page.
  // The loading skeleton is a second <main> for a moment: look for the name itself.
  await page.goto(`/epreuves/${slug}`);
  await expect(page.getByText("Sha'Carri Richardson").first()).toBeVisible();
  await expect(page.getByText(/jeu de test/)).toHaveCount(0);

  sql(`delete from events where slug = '${slug}'`);
});
