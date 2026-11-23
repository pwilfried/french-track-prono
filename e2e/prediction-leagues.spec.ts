import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { defaultCompetitionSlug } from "./competitions";
import { addFriendTo, newPlayer, signUp } from "./players";

test("a podium composed from the home counts only in the league the player ticks (#1068)", async ({
  page,
}) => {
  const competition = defaultCompetitionSlug();
  const tag = `${Date.now() % 1000000}`;
  const player = newPlayer("pick-league");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);

  // Two leagues of the player counting the competition, a friend in each: their rankings show.
  const leagueOf = (name: string) =>
    sql(`with u as (select id from auth.users where email = '${player.email}'),
      l as (insert into leagues (name, owner_id) select '${name}', id from u returning id, owner_id),
      m as (insert into league_members (league_id, user_id, role) select id, owner_id, 'owner' from l),
      c as (insert into league_competitions (league_id, competition_id)
            select l.id, c.id from l, competitions c where c.slug = '${competition}')
      select id from l`);
  const amis = `Amis ${tag}`;
  const club = `Club ${tag}`;
  const amisId = leagueOf(amis);
  const clubId = leagueOf(club);
  const friends = [
    addFriendTo(`/ligues/${amisId}`, `${tag}a`),
    addFriendTo(`/ligues/${clubId}`, `${tag}c`),
  ];

  try {
    // From the home, the next action opens the final to predict.
    await page.goto("/");
    await page
      .getByRole("region", { name: "Ta prochaine action" })
      .getByRole("link", { name: "Faire mon podium" })
      .click();
    await page.waitForURL(/\/epreuves\/[^/]+$/);
    const slug = new URL(page.url()).pathname.split("/").pop()!;
    const athletes = page.locator("li > button[aria-pressed]");
    for (const index of [0, 1, 2]) await athletes.nth(index).click();
    await page.getByRole("button", { name: "Enregistrer mon podium" }).click();

    // The sheet: the general ranking always, both leagues, nothing ticked.
    const sheet = page.getByRole("dialog", { name: "Ajouter ce prono à mes ligues" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Classement général", { exact: true })).toBeVisible();
    await expect(sheet.getByText("Toujours", { exact: true })).toBeVisible();
    const amisBox = sheet.getByRole("checkbox", { name: new RegExp(amis) });
    const clubBox = sheet.getByRole("checkbox", { name: new RegExp(club) });
    await expect(amisBox).not.toBeChecked();
    await expect(clubBox).not.toBeChecked();
    await expect(sheet.getByRole("button", { name: "Coche au moins une ligue" })).toBeDisabled();

    // One league of the two.
    await amisBox.check();
    await sheet.getByRole("button", { name: "Ajouter à 1 ligue" }).click();
    await expect(sheet).toBeHidden();

    // Under the podium, the same choice, still open to change until the lock.
    const block = page.getByRole("region", { name: "🃏 Sors tes jokers" });
    await expect(
      block.getByRole("switch", { name: `Compter ce prono dans ${amis}` }),
    ).toBeChecked();
    await expect(
      block.getByRole("switch", { name: `Compter ce prono dans ${club}` }),
    ).not.toBeChecked();
    await page.reload();
    await expect(page.getByRole("switch", { name: `Compter ce prono dans ${amis}` })).toBeChecked();

    // Points as the admin would compute them: they count in « Amis » only.
    sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
      select u.id, e.competition_id, e.id, 'prediction', 12, 'prediction',
             jsonb_build_object('reasons', '[{"kind":"perfect_podium"}]'::jsonb)
      from auth.users u, events e
      where u.email = '${player.email}' and e.slug = '${slug}'`);
    const myRow = () =>
      page
        .getByRole("list", { name: "Classement" })
        .getByRole("listitem")
        .filter({ hasText: player.pseudo });
    await page.goto(`/ligues/${amisId}`);
    await expect(myRow()).toContainText("12");
    await page.goto(`/ligues/${clubId}`);
    await expect(myRow().getByText("0 point", { exact: true })).toHaveCount(1);
  } finally {
    sql(`delete from score_events
         where user_id = (select id from auth.users where email = '${player.email}')`);
    sql(`delete from leagues where id in ('${amisId}', '${clubId}')`);
    sql(`delete from auth.users where email in ('${friends.join("', '")}')`);
  }
});

test("a podium composed from a league counts there by default, then goes to the jokers (#1147)", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  // A competition of its own with a single open final: the league button opens it directly.
  const competition = `e2e-from-league-${tag}`;
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${competition}', 'Meeting ${tag}', current_date + 5, current_date + 6) returning id
    ), e as (
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select id, '${competition}-100m', '100 m', 'F', now() + interval '5 days', now() + interval '5 days'
      from c returning id
    )
    insert into entries (event_id, athlete_id)
    select e.id, a.id from e, (select id from athletes where gender = 'F' order by name limit 4) a`);
  const player = newPlayer("from-league");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);

  const leagueOf = (name: string) =>
    sql(`with u as (select id from auth.users where email = '${player.email}'),
      l as (insert into leagues (name, owner_id) select '${name}', id from u returning id, owner_id),
      m as (insert into league_members (league_id, user_id, role) select id, owner_id, 'owner' from l),
      c as (insert into league_competitions (league_id, competition_id)
            select l.id, c.id from l, competitions c where c.slug = '${competition}')
      select id from l`);
  const amis = `Amis ${tag}`;
  const club = `Club ${tag}`;
  const amisId = leagueOf(amis);
  const clubId = leagueOf(club);

  try {
    await page.goto(`/ligues/${amisId}`);
    await page
      .getByRole("region", { name: "Pronostiquer dans cette ligue" })
      .getByRole("link", { name: /Pronostiquer/ })
      .click();
    await page.waitForURL(/\/epreuves\/[^/?]+\?ligue=/);
    const athletes = page.locator("li > button[aria-pressed]");
    for (const index of [0, 1, 2]) await athletes.nth(index).click();
    await page.getByRole("button", { name: "Enregistrer mon podium" }).click();

    // The league the player comes from is not asked: only the other one is offered.
    const sheet = page.getByRole("dialog", { name: "Ajouter ce prono à mes ligues" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(amis)).toHaveCount(1); // only in the sentence
    await sheet.getByRole("button", { name: `Ajouter à « ${club} »` }).click();
    await expect(sheet).toBeHidden();

    const block = page.getByRole("region", { name: "🃏 Sors tes jokers" });
    await expect(block).toBeInViewport();
    await expect(
      block.getByRole("switch", { name: `Compter ce prono dans ${amis}` }),
    ).toBeChecked();
    await expect(
      block.getByRole("switch", { name: `Compter ce prono dans ${club}` }),
    ).toBeChecked();
  } finally {
    sql(`delete from leagues where id in ('${amisId}', '${clubId}')`);
    sql(`delete from competitions where slug = '${competition}'`);
  }
});
