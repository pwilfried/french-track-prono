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
  await reporterPage.getByRole("link", { name: "Découvrir" }).click();
  await reporterPage.getByRole("button", { name: `Signaler la ligue ${name} à l'admin` }).click();
  await expect(reporterPage.locator("main").getByRole("status")).toContainText("Signalée");
  sql(`insert into league_members (league_id, user_id)
       select l.id, p.id from leagues l, profiles p
       where l.name = '${name}' and p.pseudo = '${reporter.pseudo}'`);

  // The admin sees it among the reported leagues and renames it.
  await adminPage.goto("/connexion");
  await signUp(adminPage, admin);
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${admin.email}')`,
  );
  await adminPage.goto("/admin/ligues");
  // The reported leagues come first; the sheet shows the members and the reports to handle.
  await adminPage.getByLabel("Chercher une ligue").fill(name);
  const row = adminPage
    .getByRole("list", { name: "Ligues" })
    .getByRole("listitem")
    .filter({ hasText: name });
  await expect(row).toContainText("1 signalement");
  await row.getByRole("button", { name: `Ouvrir ${name}` }).click();
  const sheet = adminPage.getByRole("complementary", { name });
  await expect(sheet.getByRole("list", { name: "Classement et membres" })).toContainText(
    creator.pseudo,
  );
  // The reporter joined this public league: the admin removes him (confirmed, logged).
  await sheet.getByRole("button", { name: `Retirer ${reporter.pseudo}` }).click();
  await adminPage
    .getByRole("dialog", { name: `Retirer ${reporter.pseudo} de la ligue ?` })
    .getByRole("button", { name: "Retirer" })
    .click();
  await expect(adminPage.getByRole("status").filter({ hasText: "Membre retiré." })).toBeVisible();
  await expect(sheet.getByRole("list", { name: "Classement et membres" })).not.toContainText(
    reporter.pseudo,
  );
  // Entrée renames it; its reports are cleared.
  await sheet.getByLabel("Nouveau nom").fill(`Gazelles ${tag}`);
  await sheet.getByLabel("Nouveau nom").press("Enter");
  await expect(adminPage.getByRole("status").filter({ hasText: "Ligue renommée." })).toBeVisible();
  await expect(row).toHaveCount(0);
  await adminPage.goto("/admin/historique");
  await expect(
    adminPage.getByRole("list", { name: "Actions" }).getByRole("listitem").first(),
  ).toContainText("Ligue modérée");
});
