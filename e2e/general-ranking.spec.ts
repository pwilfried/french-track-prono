import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { joinLeagueFor, newPlayer, signUp } from "./players";

test("the ranking opens on my league, and the general one adds up every competition", async ({
  page,
}) => {
  // Two finished competitions of their own, one event each: the scope sheet lists them (#661).
  const tag = `e2e-general-${Date.now() % 1000000}`;
  for (const i of [0, 1]) {
    const ago = 40 - i * 10;
    sql(`with c as (
        insert into competitions (slug, name, starts_on, ends_on)
        values ('${tag}-${i}', 'Test général ${tag} ${i}', current_date - ${ago}, current_date - ${ago - 1})
        returning id
      )
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select id, '${tag}-${i}-100m', '100 m', 'F', now() - interval '${ago} days',
             now() - interval '${ago} days' - interval '1 hour'
      from c`);
  }
  // Cleaned up even on failure: finished competitions left behind would leak into other tests.
  try {
    const player = newPlayer("general");
    await page.goto("/connexion?next=/classement");
    await signUp(page, player);
    await page.waitForURL(/\/classement$/);

    // The tab opens on « Ma ligue » (#551): without a league, create or join one.
    const views = page.getByRole("tablist", { name: "Vue du classement" });
    await expect(views.getByRole("tab", { name: "Ma ligue" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("link", { name: "Créer une ligue" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Rejoindre avec un code" })).toBeVisible();

    // In a league counting the first competition.
    joinLeagueFor(player.email, `${tag}-0`);
    // A league counts events locked after joining: the competitions are past, so join earlier.
    sql(`update league_members set joined_at = now() - interval '60 days'
       where user_id = (select id from auth.users where email = '${player.email}')`);
    // Points in each competition, as the admin would compute them: 40 then 33.
    for (const [i, points] of [40, 33].entries()) {
      sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
      select u.id, e.competition_id, e.id, 'prediction', ${points}, 'prediction',
             jsonb_build_object('reasons', '[{"kind":"exact","slot":1}]'::jsonb)
      from auth.users u, events e
      where u.email = '${player.email}' and e.slug = '${tag}-${i}-100m'`);
    }
    await page.reload();

    // « Ma ligue »: the league's competition only, the player's line highlighted, the bar below.
    await expect(page.getByText("Ta ligue · Ligue E2E")).toBeVisible();
    const inLeague = page
      .getByRole("list", { name: "Classement" })
      .getByRole("listitem")
      .filter({ hasText: player.pseudo });
    await expect(inLeague).toHaveAttribute("aria-current", "true");
    await expect(inLeague).toContainText("40");
    await expect(page.getByText("Tu es 1er · 40 pts")).toBeVisible();
    await expect(page.getByRole("link", { name: "Autour de moi" })).toHaveAttribute("href", "#moi");
    // « Ta place » heads the list (#661): alone in the league, nobody ahead.
    const myPlace = page.getByRole("region", { name: "Ta place" });
    await expect(myPlace).toContainText("1er");
    await expect(myPlace).toContainText("Personne devant toi");

    // Another league: the scope sheet switches to it (#661).
    const other = sql(`with u as (select id from auth.users where email = '${player.email}'),
      l as (insert into leagues (name, owner_id) select 'Une autre ligue ${tag}', id from u returning id, owner_id),
      m as (insert into league_members (league_id, user_id, role) select id, owner_id, 'owner' from l)
    select id from l`);
    await page.reload();
    await page.getByRole("button", { name: /Changer de classement \(Ligue E2E/ }).click();
    const sheet = page.getByRole("dialog", { name: "Choisir le classement" });
    await expect(sheet.getByRole("tab", { name: "Mes ligues" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(sheet.locator('[aria-current="page"]')).toContainText("Ligue E2E");
    await sheet.getByRole("link", { name: new RegExp(`Une autre ligue ${tag}`) }).click();
    await expect(page).toHaveURL(new RegExp(`ligue=${other}`));
    await expect(page.getByText(`Ta ligue · Une autre ligue ${tag}`)).toBeVisible();

    // « Général » shows the player's line, whatever their place, under a single scope button.
    await views.getByRole("tab", { name: "Général" }).click();
    await expect(page).toHaveURL(/vue=general/);
    // The subtitle under the title; the scope card repeats it in the tab panel.
    await expect(
      page.getByRole("paragraph").filter({ hasText: "Tous les joueurs · toutes les compétitions" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Changer de classement/ })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Choisir le classement" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Ta place" })).toContainText(/Top \d+ %/);
    const mine = page
      .getByRole("list", { name: "Classement" })
      .getByRole("listitem")
      .filter({ hasText: player.pseudo });
    await expect(mine).toContainText("73");
    await expect(mine).toHaveAttribute("id", "moi");

    // The ranking of one finished competition, chosen in the sheet, counts its points only (#376).
    await page.getByRole("button", { name: /Changer de classement/ }).click();
    const scopes = page.getByRole("dialog", { name: "Choisir le classement" });
    await scopes.getByRole("searchbox").fill(tag);
    await scopes.getByRole("link", { name: new RegExp(`Test général ${tag} 0`) }).click();
    await expect(page).toHaveURL(new RegExp(`competition=${tag}-0$`));
    await expect(
      page
        .getByRole("list", { name: "Classement" })
        .getByRole("listitem")
        .filter({ hasText: player.pseudo }),
    ).toContainText("40");

    // Touching the pseudo shows the minimal card: club and rank, no e-mail (#342).
    sql(`update profiles set club_id = (select id from clubs where name = 'Athlé Club des Tests')
       where pseudo = '${player.pseudo}'`);
    await page.reload();
    await page.getByRole("button", { name: `Voir la fiche de ${player.pseudo}` }).click();
    const card = page.getByRole("region", { name: `Fiche de ${player.pseudo}` });
    await expect(card).toContainText("Athlé Club des Tests");
    await expect(card).toContainText(/sur \d+ joueurs?/);
    await expect(card).not.toContainText("@");
  } finally {
    sql(`delete from competitions where slug like '${tag}-%'`);
  }
});

test("a visitor sees the general ranking alone, and signs in to play", async ({ page }) => {
  const tag = `e2e-visitor-${Date.now() % 1000000}`;
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${tag}', 'Test visiteur ${tag}', current_date - 1, current_date + 1)
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, '${tag}-100m', '100 m', 'F', now() - interval '1 hour', now() - interval '2 hours'
    from c`);
  // Two players with points; the second is blocked and stays out of the visitor's ranking too.
  const [shown, blocked] = [newPlayer("seen"), newPlayer("hidden")];
  for (const [player, points] of [
    [shown, 21],
    [blocked, 30],
  ] as const) {
    sql(`with u as (
        insert into auth.users (id, email) values (gen_random_uuid(), '${player.email}') returning id
      ), p as (
        insert into profiles (id, pseudo, age_confirmed_at) select id, '${player.pseudo}', now()
        from u returning id
      )
      insert into score_events (user_id, competition_id, event_id, source, points, reason)
      select p.id, e.competition_id, e.id, 'prediction', ${points}, 'prediction'
      from p, events e where e.slug = '${tag}-100m'`);
  }
  sql(`update profiles set blocked_at = now() where pseudo = '${blocked.pseudo}'`);

  await page.goto(`/classement?vue=general&competition=${tag}`);
  await expect(page).toHaveURL(/\/classement\?/);
  const views = page.getByRole("tablist", { name: "Vue du classement" });
  await expect(views.getByRole("tab")).toHaveText(["Général"]);
  const ranking = page.getByRole("list", { name: "Classement" });
  await expect(ranking.getByText(shown.pseudo)).toBeVisible();
  await expect(page.getByText(blocked.pseudo)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Autour de moi" })).toHaveCount(0);

  await page.locator("main").getByRole("link", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/connexion\?next=/);

  sql(`delete from competitions where slug = '${tag}'`);
  sql(`delete from auth.users where email in ('${shown.email}', '${blocked.email}')`);
});
