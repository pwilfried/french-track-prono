import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a player joins a public Manager league in one tap and a private one by its link", async ({
  browser,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const open = `Sprinteurs ${tag}`;
  const closed = `Marcheurs ${tag}`;
  const creator = newPlayer("mgr-create");
  const joiner = newPlayer("mgr-join");
  const creatorPage = await (await browser.newContext()).newPage();
  const joinerPage = await (await browser.newContext()).newPage();

  // The creator makes a public league, then a private one.
  await creatorPage.goto("/manager/creer");
  await signUp(creatorPage, creator);
  await creatorPage.waitForURL(/\/manager\/creer$/);
  await creatorPage.getByLabel("Nom de la ligue").fill(open);
  await creatorPage.getByText("Ligue publique").click();
  await creatorPage.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(creatorPage.getByText("1 / 4 participants · Publique")).toBeVisible();
  await creatorPage.goto("/manager/creer");
  await creatorPage.getByLabel("Nom de la ligue").fill(closed);
  await creatorPage.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(creatorPage.getByRole("heading", { level: 1 })).toHaveText(closed);
  // Its creator shares the code, or the link that brings it.
  await expect(creatorPage.getByRole("button", { name: "Partager le lien" })).toBeVisible();
  const code = sql(`select invite_code from manager_leagues where name = '${closed}'`);

  // Another player sees the public league with its free places and joins it in one tap.
  await joinerPage.goto("/manager");
  await signUp(joinerPage, joiner);
  await joinerPage.waitForURL(/\/manager$/);
  // Without a Manager league the presentation comes first; « Passer » shows the leagues (#618).
  await joinerPage.getByRole("link", { name: "Passer la présentation" }).click();
  await joinerPage.waitForURL(/\/manager\?passer=1$/);
  const publics = joinerPage.getByRole("list", { name: "Ligues publiques" });
  await expect(publics.getByRole("listitem").filter({ hasText: open })).toContainText(
    "1 / 4 participants",
  );
  await expect(publics).not.toContainText(closed);
  await publics.getByRole("button", { name: `Rejoindre la ligue ${open}` }).click();
  await expect(joinerPage.getByRole("heading", { level: 1 })).toHaveText(open);
  await expect(joinerPage.getByText("2 / 4 participants · Publique")).toBeVisible();
  await expect(joinerPage.getByRole("list", { name: "Participants" })).toContainText(
    creator.pseudo,
  );

  // The invite link fills in the code of the private league.
  await joinerPage.goto(`/manager/rejoindre?code=${code}`);
  await expect(joinerPage.getByLabel("Code d'invitation")).toHaveValue(code);
  await joinerPage.getByRole("button", { name: "Rejoindre la ligue" }).click();
  await expect(joinerPage.getByRole("heading", { level: 1 })).toHaveText(closed);
  await expect(joinerPage.getByText("2 / 4 participants · Privée")).toBeVisible();

  // Once the mercato is open, nobody joins any more.
  sql(`update manager_leagues set mercato_opened_at = now() where name = '${closed}'`);
  sql(`delete from manager_members where user_id = (select id from profiles where pseudo = '${joiner.pseudo}')
       and league_id = (select id from manager_leagues where name = '${closed}')`);
  await joinerPage.goto(`/manager/rejoindre?code=${code}`);
  await joinerPage.getByRole("button", { name: "Rejoindre la ligue" }).click();
  await expect(
    joinerPage.locator("main").getByText(/mercato de cette ligue a commencé/),
  ).toBeVisible();
});
