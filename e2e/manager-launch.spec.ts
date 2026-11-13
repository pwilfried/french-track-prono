import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";
import {
  ensureManagerCompetitions,
  managerCompetitionDay,
  pickManagerCompetitions,
} from "./manager";

test("the creator of a league of 6 competitions launches the mercato once 3 friends are in", async ({
  browser,
}) => {
  ensureManagerCompetitions();
  test.slow();
  const league = `Lanceurs ${Date.now() % 1000000}`;
  const creator = newPlayer("mgr-launch");
  const creatorPage = await (await browser.newContext()).newPage();

  // Six competitions make a league of 4 players: launching is not possible yet.
  await creatorPage.goto("/manager/creer");
  await signUp(creatorPage, creator);
  await creatorPage.waitForURL(/\/manager\/creer$/);
  await creatorPage.getByLabel("Nom de la ligue").fill(league);
  await pickManagerCompetitions(creatorPage);
  await creatorPage.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(creatorPage.getByRole("heading", { level: 1 })).toHaveText(league);
  await expect(creatorPage.getByText("1 / 4 participants · Privée")).toBeVisible();
  await expect(creatorPage.getByRole("heading", { name: "Inviter des amis" })).toBeVisible();
  await expect(
    creatorPage.getByRole("button", { name: "Encore 3 joueurs attendus" }),
  ).toBeDisabled();

  // Custom rounds, the mercato starting the evening the first competition starts: it would
  // not count, and 5 competitions are too few for 4 players (#644).
  await creatorPage.getByText("Personnalisé").click();
  await creatorPage.getByLabel("1er tour").selectOption("48");
  await creatorPage.getByLabel("Tours suivants").selectOption("12");
  const startsAt = creatorPage.getByLabel("Début du mercato (heure de Paris)");
  await startsAt.fill(`${managerCompetitionDay(1)}T20:00`);
  await creatorPage.getByRole("button", { name: "Enregistrer les réglages" }).click();
  await expect(creatorPage.getByText("Réglages enregistrés.")).toBeVisible();
  const notes = creatorPage.getByRole("note");
  await expect(notes.first()).toContainText(
    "Ton mercato finira après le début de Meeting E2E Manager 1",
  );
  await expect(notes.first()).toContainText(
    "Elle ne comptera pas : la saison commencera à Meeting E2E Manager 2.",
  );
  await expect(notes.nth(1)).toContainText("Il manque alors 1 compétition pour l'aller-retour");

  // Without a start date, the mercato is over in time: the warnings go.
  await startsAt.fill("");
  await creatorPage.getByRole("button", { name: "Enregistrer les réglages" }).click();
  await expect(creatorPage.getByRole("note")).toHaveCount(0);
  const calendar = creatorPage.getByRole("list", { name: "Calendrier des tours" });
  await expect(calendar).toContainText("Tour 1 · 48 h");
  await expect(calendar).toContainText("Tour 2 · 12 h");

  // Three friends join with the invite link.
  const code = sql(`select invite_code from manager_leagues where name = '${league}'`);
  for (const tag of ["mgr-friend-a", "mgr-friend-b", "mgr-friend-c"]) {
    const page = await (await browser.newContext()).newPage();
    await page.goto("/manager");
    await signUp(page, newPlayer(tag));
    await page.waitForURL(/\/manager$/);
    await page.goto(`/manager/rejoindre?code=${code}`);
    await page.getByRole("button", { name: "Rejoindre la ligue" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(league);
    await page.context().close();
  }

  // The button unlocks; launching opens round 1.
  await creatorPage.reload();
  await expect(creatorPage.getByText("4 / 4 participants · Privée")).toBeVisible();
  await creatorPage.getByRole("button", { name: "Lancer le mercato maintenant" }).click();
  await creatorPage.waitForURL(/\/catalogue$/);
  await expect(creatorPage.getByText("Fin du tour dans")).toBeVisible();
  expect(
    sql(`select r.round from manager_leagues l, private.manager_open_round(l.id) r
         where l.name = '${league}'`),
  ).toBe("1");
});
