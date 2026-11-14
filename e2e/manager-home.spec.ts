import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("the Manager tab lists my leagues; a league tells my season and the action of the moment (#606, #774)", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const player = newPlayer("mhome");
  await page.goto("/manager");
  await signUp(page, player);
  await page.waitForURL(/\/manager$/);
  const playerId = sql(`select id from auth.users where email = '${player.email}'`);

  // Without a league: past the tutorial and the presentation, the mode, the ways in and the steps.
  await page.getByRole("dialog").getByRole("button", { name: "Passer le tutoriel" }).click();
  await page.getByRole("link", { name: "Passer la présentation" }).click();
  await page.waitForURL(/\/manager\?passer=1$/);
  await expect(page.getByRole("heading", { name: "Créer ou rejoindre une ligue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Rejoindre avec un code" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Comment ça marche ?" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ma saison" })).toHaveCount(0);
  const steps = page.getByRole("list", { name: "Le déroulé de la saison" }).getByRole("listitem");
  await expect(steps).toHaveCount(7);
  await expect(steps.first()).toHaveAttribute("aria-current", "step");
  await expect(steps.first()).toContainText("Ligue");

  // A league whose mercato is closed: two head-to-head matchdays a day apart, then a bonus one.
  const rivalPseudo = `Rival ${tag}`;
  const rivalId = sql(`with u as (
      insert into auth.users (id, email)
      values (gen_random_uuid(), 'e2e-mhome-rival-${tag}@example.test') returning id
    )
    insert into profiles (id, pseudo, age_confirmed_at)
    select id, '${rivalPseudo}', now() from u returning id`);
  const competitions = [1, 2, 3].map((day) => {
    const id = sql(`insert into competitions (slug, name, starts_on, ends_on)
      values ('mhome-${day}-${tag}', 'Meeting Accueil ${day} ${tag}', current_date + ${day},
              current_date + ${day}) returning id`);
    sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
         values ('${id}', 'mhome-100-${day}-${tag}', '100 m', 'F',
                 now() + interval '${day} days', now() + interval '${day} days')`);
    return id;
  });
  const league = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids)
    select 'Accueil ${tag}', '${playerId}', rules, array['${competitions.join("','")}']::uuid[]
    from manager_rules returning id`);
  sql(`insert into manager_members (league_id, user_id)
       values ('${league}', '${playerId}'), ('${league}', '${rivalId}')`);
  sql(`update manager_leagues set mercato_opened_at = now() - interval '2 days',
         mercato_closed_at = now() where id = '${league}'`);
  // Matchday 1 is scored: the player wins 900 – 700.
  sql(`insert into manager_scores (league_id, competition_id, user_id, lined_up, total, hungarian,
                                   bonus, predictions)
       values ('${league}', '${competitions[0]}', '${playerId}', true, 900, 900, 0, 0),
              ('${league}', '${competitions[0]}', '${rivalId}', true, 700, 700, 0, 0)`);

  // A second league whose mercato opened an hour ago.
  const mercato = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids)
    select 'Mercato ${tag}', '${playerId}', rules, array['${competitions.join("','")}']::uuid[]
    from manager_rules returning id`);
  sql(`insert into manager_members (league_id, user_id)
       values ('${mercato}', '${playerId}'), ('${mercato}', '${rivalId}')`);
  sql(`update manager_leagues set mercato_opened_at = now() - interval '1 hour'
       where id = '${mercato}'`);

  // The tab lists both leagues, « Créer » and « Rejoindre » above them, out of the league content.
  await page.goto("/manager");
  await expect(page.getByRole("region", { name: "Ma saison" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Créer une ligue Manager" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Rejoindre avec un code" })).toBeVisible();
  const mine = page.getByRole("list", { name: "Mes ligues Manager" });
  await expect(mine.getByRole("listitem")).toHaveCount(2);
  const seasonCard = mine.getByRole("link", { name: `Accueil ${tag}`, exact: true });
  await expect(seasonCard).toHaveAccessibleDescription(/Saison · journée 2 sur 3 · 1re place/);
  await expect(seasonCard).toHaveAccessibleDescription(/Verrou d'alignement dans /);
  await expect(seasonCard).toHaveAccessibleDescription(/Alignement à valider/);
  const mercatoCard = mine.getByRole("link", { name: `Mercato ${tag}`, exact: true });
  await expect(mercatoCard).toHaveAccessibleDescription(/Mercato · tour 1/);
  await expect(mercatoCard).toHaveAccessibleDescription(/Fin du tour dans /);
  await expect(mercatoCard).toHaveAccessibleDescription(/Enchères à faire/);

  // Entering the mercato league, then back to the list.
  await mercatoCard.click();
  await page.waitForURL(new RegExp(`/manager/${mercato}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Mercato ${tag}`);
  await expect(page.getByText(/^Mercato · tour 1 · 2 \/ \d+ participants · Privée$/)).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Ma saison" }).getByRole("link", { name: "Aller au mercato" }),
  ).toHaveAttribute("href", `/manager/${mercato}/catalogue`);
  await page.getByRole("link", { name: "‹ French Track Manager" }).click();
  await page.waitForURL(/\/manager$/);
  await expect(mine.getByRole("listitem")).toHaveCount(2);

  // The season league: matchday 2 of 3, first with 3 points and +200, the next head-to-head.
  await seasonCard.click();
  await page.waitForURL(new RegExp(`/manager/${league}$`));
  const season = page.getByRole("region", { name: "Ma saison" });
  await expect(season).toContainText("Saison · journée 2 sur 3");
  await expect(season).toContainText("1er");
  await expect(season).toContainText("1 V · 0 N · 0 D");
  await expect(season).toContainText("+200");
  await expect(season.getByLabel(`${player.pseudo} contre ${rivalPseudo}`)).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: "Mes derniers points" }),
  ).toHaveAttribute("href", `/manager/${league}/points/mhome-1-${tag}`);

  // The action of the moment: line up the team before matchday 2 locks.
  await season.getByRole("link", { name: /^Aligner mon équipe · verrouillage dans / }).click();
  await page.waitForURL(new RegExp(`/manager/${league}/alignement/mhome-2-${tag}$`));

  sql(`delete from manager_leagues where id = '${mercato}'`);
  sql(`delete from manager_leagues where id = '${league}'`);
  sql(`delete from competitions where id in ('${competitions.join("','")}')`);
  sql(`delete from auth.users where id = '${rivalId}'`);
});
