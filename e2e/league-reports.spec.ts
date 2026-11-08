import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a player reports a public league and the admin renames it", async ({ browser }) => {
  const tag = `${Date.now() % 1000000}`;
  const name = `Douteuse ${tag}`;
  const creator = newPlayer("repcreate");
  const reporter = newPlayer("reporter");
  const admin = newPlayer("modo");
  const creatorPage = await (await browser.newContext()).newPage();
  const reporterPage = await (await browser.newContext()).newPage();
  const adminPage = await (await browser.newContext()).newPage();

  await creatorPage.goto("/ligues/creer");
  await signUp(creatorPage, creator);
  await creatorPage.waitForURL(/\/ligues\/creer/);
  await creatorPage.getByLabel("Nom de la ligue").fill(name);
  await creatorPage.getByRole("checkbox", { name: /Ligue publique/ }).check();
  await creatorPage.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(creatorPage.getByText("Ta ligue est prête")).toBeVisible();

  // Another player reports it from the list of public leagues.
  await reporterPage.goto("/ligues");
  await signUp(reporterPage, reporter);
  await reporterPage.waitForURL(/\/ligues$/);
  await reporterPage.getByRole("button", { name: `Signaler la ligue ${name} à l'admin` }).click();
  await expect(reporterPage.locator("main").getByRole("status")).toContainText("Signalée");

  // The admin sees it among the reported leagues and renames it.
  await adminPage.goto("/connexion");
  await signUp(adminPage, admin);
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${admin.email}')`,
  );
  await adminPage.goto("/admin/ligues");
  const reported = adminPage.getByRole("list", { name: "Ligues signalées" }).getByRole("listitem");
  await expect(reported.filter({ hasText: name })).toContainText("1 signalement");
  await adminPage.getByLabel(`Nouveau nom pour ${name}`).fill(`Gazelles ${tag}`);
  await reported.filter({ hasText: name }).getByRole("button", { name: "Renommer" }).click();
  await expect(adminPage.locator("main").getByRole("status")).toContainText("C'est fait");

  // Renamed, it leaves the list; the log keeps the action.
  await adminPage.reload();
  await expect(adminPage.getByText(name)).toHaveCount(0);
  await adminPage.goto("/admin/historique");
  await expect(
    adminPage.getByRole("list", { name: "Actions" }).getByRole("listitem").first(),
  ).toContainText("Ligue modérée");
});
