import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { addFriendTo, countInLeagues, joinLeagueFor, newPlayer, signUp } from "./players";

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
  let friend: string | null = null;
  try {
    const player = newPlayer("general");
    await page.goto("/connexion?next=/classement");
    await signUp(page, player);
    await page.waitForURL(/\/classement$/);

    // The tab opens on « Ligues » (#551): without a league, create or join one.
    const views = page.getByRole("tablist", { name: "Vue du classement" });
    await expect(views.getByRole("tab", { name: "👥 Ligues" })).toHaveAttribute(
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
    // The player added their podiums to the league (#1068).
    countInLeagues(`${tag}-%`);
    await page.reload();

    // Alone in the league: an invitation to bring friends in, no ranking of one (#710).
    const invite = page.getByRole("region", { name: "Tu es seul pour l'instant" });
    await expect(invite.getByRole("button", { name: "Inviter mes amis" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Classement" })).toHaveCount(0);

    // A friend joins: the ranking shows.
    const leagueId = sql(`select l.id from leagues l join auth.users u on u.id = l.owner_id
       where u.email = '${player.email}'`);
    friend = addFriendTo(leagueId, tag);
    await page.reload();

    // « Ligues »: the league's competition only; the player on the podium, outlined, the friend
    // without points in the list, last of the league (#1131).
    await expect(page.getByText("Ligue E2E · 2 joueurs")).toBeVisible();
    const onPodium = page
      .getByRole("list", { name: "Podium" })
      .getByRole("listitem")
      .filter({ hasText: player.pseudo });
    await expect(onPodium).toHaveAttribute("aria-current", "true");
    await expect(onPodium).toContainText("40");
    await expect(page.getByRole("list", { name: "Classement" })).toContainText("Lanterne rouge");
    // « Ta place » is the one place card (#661): first of the league, with the lead.
    const myPlace = page.getByRole("region", { name: "Ta place" });
    await expect(myPlace).toContainText("1er");
    await expect(myPlace).toContainText("😎 40 pts d'avance");

    // Another league: its chip switches to it (#1131).
    const other = sql(`with u as (select id from auth.users where email = '${player.email}'),
      l as (insert into leagues (name, owner_id) select 'Une autre ligue ${tag}', id from u returning id, owner_id),
      m as (insert into league_members (league_id, user_id, role) select id, owner_id, 'owner' from l)
    select id from l`);
    await page.reload();
    const scopes = page.getByRole("navigation", { name: "Choisir le classement" });
    await expect(scopes.getByRole("link", { name: /Ligue E2E/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await scopes.getByRole("link", { name: `🏆 Une autre ligue ${tag}` }).click();
    await expect(page).toHaveURL(new RegExp(`ligue=${other}`));
    await expect(page.getByText(`Une autre ligue ${tag} · 1 joueur`)).toBeVisible();

    // « Ce soir » opens on the first league, with a chip per league and « 🌍 Tous » (#1132).
    await views.getByRole("tab", { name: "🌙 Ce soir" }).click();
    await expect(page).toHaveURL(/vue=soir/);
    const tonight = page.getByRole("navigation", { name: "Choisir le classement" });
    await expect(tonight.getByRole("link", { name: /Ligue E2E/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await tonight.getByRole("link", { name: "🌍 Tous" }).click();
    await expect(page).toHaveURL(/ligue=tous/);
    // No finals tonight here: the last evening with points, or tonight's waiting for results
    // when another test runs a live competition.
    await expect(
      page.getByText(/😴 Pas de finale ce soir|Points des finales de ce soir/).first(),
    ).toBeVisible();

    // « Général » shows the player's place, whatever it is, and no sheet to open.
    await views.getByRole("tab", { name: "🌍 Général" }).click();
    await expect(page).toHaveURL(/vue=general/);
    await expect(
      page.getByText(/Tous les joueurs · toute la saison .* · [\d\s\u202f\u00a0]+ joueurs?/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Changer de classement/ })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Ta place" })).toContainText("73");
    await expect(page.getByRole("link", { name: /Battez FrenchTrack/ })).toBeVisible();

    // The ranking of one finished competition, chosen with its chip, counts its points only (#376).
    await page
      .getByRole("navigation", { name: "Choisir le classement" })
      .getByRole("link", { name: new RegExp(`Test général ${tag} 0`) })
      .click();
    await expect(page).toHaveURL(new RegExp(`competition=${tag}-0$`));
    await expect(page.getByRole("region", { name: "Ta place" })).toContainText("40");

    // Touching the pseudo shows the minimal card: club and rank, no e-mail (#342).
    sql(`update profiles set club_id = (select id from clubs where name = 'Athlé Club des Tests')
       where pseudo = '${player.pseudo}'`);
    await page.goto(`/ligues/${leagueId}`);
    await page.getByRole("button", { name: `Voir la fiche de ${player.pseudo}` }).click();
    const card = page.getByRole("region", { name: `Fiche de ${player.pseudo}` });
    await expect(card).toContainText("Athlé Club des Tests");
    await expect(card).toContainText(/sur \d+ joueurs?/);
    await expect(card).not.toContainText("@");
  } finally {
    sql(`delete from competitions where slug like '${tag}-%'`);
    if (friend) sql(`delete from auth.users where email = '${friend}'`);
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
  // « Général » alone is no choice: no view switch (#939).
  await expect(page.getByRole("tablist", { name: "Vue du classement" })).toHaveCount(0);
  // Alone with points, the player stands on the podium (#1131).
  const ranking = page.getByRole("list", { name: "Podium" });
  await expect(ranking.getByText(shown.pseudo)).toBeVisible();
  await expect(page.getByText(blocked.pseudo)).toHaveCount(0);

  await page.locator("main").getByRole("link", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/connexion\?next=/);

  sql(`delete from competitions where slug = '${tag}'`);
  sql(`delete from auth.users where email in ('${shown.email}', '${blocked.email}')`);
});
