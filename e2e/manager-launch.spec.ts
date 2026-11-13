import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { chooseSeason, seasonReady } from "./manager-season";
import { newPlayer, signUp } from "./players";

test("the creator of a league of 6 competitions launches the mercato once 3 friends are in", async ({
  browser,
}) => {
  test.slow();
  seasonReady();
  const league = `Lanceurs ${Date.now() % 1000000}`;
  const creator = newPlayer("mgr-launch");
  const creatorPage = await (await browser.newContext()).newPage();

  // 6 competitions: 4 players, a home-and-away of 6 matchdays (#644).
  await creatorPage.goto("/manager/creer");
  await signUp(creatorPage, creator);
  await creatorPage.waitForURL(/\/manager\/creer$/);
  await creatorPage.getByLabel("Nom de la ligue").fill(league);
  await chooseSeason(creatorPage, 5);
  await expect(creatorPage.getByText("5 compétitions : il en faut au moins 6.")).toBeVisible();
  await chooseSeason(creatorPage, 6);
  await expect(
    creatorPage.getByText("6 compétitions → 4 joueurs · 6 journées aller-retour", { exact: true }),
  ).toBeVisible();
  await creatorPage.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(creatorPage.getByRole("heading", { level: 1 })).toHaveText(league);
  await expect(creatorPage.getByText("1 / 4 participants · Privée")).toBeVisible();
  await expect(creatorPage.getByRole("heading", { name: "Inviter des amis" })).toBeVisible();
  await expect(
    creatorPage.getByRole("button", { name: "Encore 3 joueurs attendus" }),
  ).toBeDisabled();

  // Custom rounds: the calendar follows them.
  await creatorPage.getByText("Personnalisé").click();
  await creatorPage.getByLabel("1er tour").selectOption("48");
  await creatorPage.getByLabel("Tours suivants").selectOption("12");
  await creatorPage.getByRole("button", { name: "Enregistrer les réglages" }).click();
  await expect(creatorPage.getByText("Réglages enregistrés.")).toBeVisible();
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

test("the creator is told when a custom mercato ends after the first competition starts", async ({
  page,
}) => {
  seasonReady();
  const tag = `${Date.now() % 1000000}`;
  const soon = `Meeting Proche ${tag}`;
  sql(`with c as (
         insert into competitions (slug, name, starts_on, ends_on)
         values ('manager-soon-${tag}', '${soon}', current_date + 4, current_date + 4)
         returning id
       )
       insert into manager_competitions (competition_id) select id from c`);
  try {
    await page.goto("/manager/creer");
    await signUp(page, newPlayer("mgr-soon"));
    await page.waitForURL(/\/manager\/creer$/);
    await page.getByLabel("Nom de la ligue").fill(`Pressés ${tag}`);
    await page.getByRole("checkbox", { name: new RegExp(`^${soon} ·`) }).check();
    await chooseSeason(page, 6);
    // 7 competitions: 4 players, one competition left over as a bonus matchday.
    await expect(
      page.getByText("7 compétitions → 4 joueurs · 6 journées aller-retour + 1 bonus"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Créer la ligue" }).click();
    await expect(page.getByText("1 / 4 participants · Privée")).toBeVisible();

    // Three rounds of 72 hours end after the meeting in 4 days: it will not count.
    await page.getByText("Personnalisé").click();
    await page.getByLabel("1er tour").selectOption("72");
    await page.getByLabel("Tours suivants").selectOption("72");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      `Ton mercato finira après le début de ${soon}`,
    );
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Elle ne comptera pas : la saison commencera à Saison Manager 1.",
    );
    // Short rounds end in time: the warning goes.
    await page.getByLabel("1er tour").selectOption("12");
    await page.getByLabel("Tours suivants").selectOption("12");
    await expect(page.getByText("Ton mercato finira après le début")).toBeHidden();
  } finally {
    sql(`delete from competitions where slug = 'manager-soon-${tag}'`);
  }
});
