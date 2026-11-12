import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("the ranking opens on my league, and the general one adds up every competition", async ({
  page,
}) => {
  // Two competitions of their own, one event each.
  const tag = `e2e-general-${Date.now() % 1000000}`;
  for (const i of [0, 1]) {
    sql(`with c as (
        insert into competitions (slug, name, starts_on, ends_on)
        values ('${tag}-${i}', 'Test général ${tag} ${i}', current_date + ${330 + i}, current_date + ${331 + i})
        returning id
      )
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select id, '${tag}-${i}-100m', '100 m', 'F', now() + interval '${330 + i} days',
             now() + interval '${330 + i} days'
      from c`);
  }
  const player = newPlayer("general");
  await page.goto("/connexion?next=/classement");
  await signUp(page, player);
  await page.waitForURL(/\/classement$/);

  // « Ma ligue » first (#551): without a league, the player creates or joins one.
  const tabs = page.getByRole("navigation", { name: "Choisir le classement" });
  await expect(tabs.getByRole("link", { name: "Ma ligue" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator("main").getByRole("link", { name: "Créer une ligue" })).toBeVisible();
  await expect(page.locator("main").getByRole("link", { name: "J'ai un code" })).toBeVisible();

  // Points in each competition, as the admin would compute them: 40 then 33.
  for (const [i, points] of [40, 33].entries()) {
    sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
      select u.id, e.competition_id, e.id, 'prediction', ${points}, 'prediction',
             jsonb_build_object('reasons', '[{"kind":"exact","slot":1}]'::jsonb)
      from auth.users u, events e
      where u.email = '${player.email}' and e.slug = '${tag}-${i}-100m'`);
  }
  await tabs.getByRole("link", { name: "Général" }).click();
  await page.waitForURL(/onglet=general$/);

  await expect(page.getByText("Tous les joueurs · toutes les compétitions")).toBeVisible();
  // My row is shown, in the top 10 or among my neighbours, and the bar leads to it.
  const mine = page
    .getByRole("list", { name: "Classement" })
    .getByRole("listitem")
    .filter({ hasText: player.pseudo });
  await expect(mine).toContainText("73");
  await expect(page.getByText(/^Tu es \d+(er|e) · 73 pts$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Autour de moi" })).toHaveAttribute("href", "#moi");

  // The ranking of one competition counts its points only (#376).
  await page.goto(`/classement?onglet=general&competition=${tag}-0`);
  await expect(page.getByText(`Tous les joueurs · Test général ${tag} 0`)).toBeVisible();
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

  sql(`delete from competitions where slug like '${tag}-%'`);
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

  await page.goto(`/classement?onglet=general&competition=${tag}`);
  await expect(page).toHaveURL(/\/classement\?/);
  const tabs = page.getByRole("navigation", { name: "Choisir le classement" });
  await expect(tabs.getByRole("link")).toHaveText(["Général"]);
  const ranking = page.getByRole("list", { name: "Classement" });
  await expect(ranking.getByText(shown.pseudo)).toBeVisible();
  await expect(page.getByText(blocked.pseudo)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Autour de moi" })).toHaveCount(0);

  await page.locator("main").getByRole("link", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/connexion\?next=/);

  sql(`delete from competitions where slug = '${tag}'`);
  sql(`delete from auth.users where email in ('${shown.email}', '${blocked.email}')`);
});
