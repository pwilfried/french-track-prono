import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a player creates a public league, another finds it in Découvrir and joins without a code", async ({
  browser,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const name = `Gazelles ${tag}`;
  const creator = newPlayer("pubcreate");
  const walker = newPlayer("pubjoin");
  const creatorPage = await (await browser.newContext()).newPage();
  const walkerPage = await (await browser.newContext()).newPage();

  await creatorPage.goto("/ligues/creer?competition=ultimate-championship-2026");
  await signUp(creatorPage, creator);
  await creatorPage.waitForURL(/\/ligues\/creer/);
  await creatorPage.getByRole("checkbox", { name: /Ligue publique/ }).check();

  // A public league is seen by everyone: a banned name is refused.
  await creatorPage.getByLabel("Nom de la ligue").fill("Ligue officielle");
  await creatorPage.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(creatorPage.locator("main").getByRole("alert")).toContainText(
    "pas possible pour une ligue",
  );

  await creatorPage.getByLabel("Nom de la ligue").fill(name);
  await creatorPage.getByRole("checkbox", { name: /Ligue publique/ }).check();
  await creatorPage.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(creatorPage.getByText("Ta ligue est prête")).toBeVisible();
  const leagueUrl = creatorPage.url().split("?")[0]!;

  // A public sprint league of the same creator, to narrow the list by family (#662).
  const sprint = `Sprinteuses ${tag}`;
  sql(`with l as (
      insert into leagues (name, owner_id, is_public)
      select '${sprint}', id from profiles where pseudo = '${creator.pseudo}'
      returning id
    )
    insert into league_families (league_id, family) select id, 'sprint' from l`);

  // Another player opens « Découvrir », searches by name, then filters by family.
  await walkerPage.goto("/ligues");
  await signUp(walkerPage, walker);
  await walkerPage.waitForURL(/\/ligues$/);
  await expect(walkerPage.getByRole("link", { name: "Mes ligues · 0" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await walkerPage.getByRole("link", { name: "Découvrir" }).click();
  await walkerPage.waitForURL(/\/ligues\?onglet=decouvrir$/);
  const publics = walkerPage.getByRole("list", { name: "Autres ligues publiques" });
  await walkerPage.getByRole("searchbox", { name: "Chercher une ligue publique" }).fill(tag);
  await expect(publics.getByRole("listitem")).toHaveCount(2);
  await walkerPage
    .getByRole("group", { name: "Famille d'épreuves" })
    .getByRole("button", { name: "Sprint" })
    .click();
  await expect(publics.getByRole("listitem")).toHaveCount(1);
  await expect(publics.getByRole("listitem")).toContainText(sprint);
  await walkerPage
    .getByRole("group", { name: "Famille d'épreuves" })
    .getByRole("button", { name: "Toutes" })
    .click();
  const row = publics.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("1/200 joueurs · 1 compétition");
  await row.getByRole("button", { name: `Rejoindre la ligue publique ${name}` }).click();
  await walkerPage.waitForURL(leagueUrl);
  await expect(walkerPage.getByRole("heading", { level: 1 })).toHaveText(name);

  // Now a member, they find it among their leagues, no longer in Découvrir.
  await walkerPage.goto("/ligues");
  await expect(walkerPage.getByRole("link", { name: "Mes ligues · 1" })).toBeVisible();
  await expect(
    walkerPage
      .getByRole("list", { name: "Mes ligues" })
      .getByRole("link", { name: new RegExp(name) }),
  ).toBeVisible();
  await walkerPage.goto("/ligues?onglet=decouvrir");
  await expect(publics.getByRole("listitem").filter({ hasText: name })).toHaveCount(0);
});
