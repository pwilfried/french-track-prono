import { expect, test } from "@playwright/test";

import { worldAthleticsPoints } from "../src/domain/world-athletics-points";
import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("the admin saves one results sheet: prediction points and the Manager head-to-head follow, with no click on Calculer", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const names = ["Alpha", "Bravo", "Charlie", "Delta"].map((n) => `${n} Feuille ${tag}`);
  const [alpha, bravo, charlie, delta] = names as [string, string, string, string];
  const ids = names.map((name, n) =>
    sql(`insert into athletes (slug, name, country_code, gender, manager_price)
         values ('sheet-${n}-${tag}', '${name}', 'FRA', 'F', 10) returning id`),
  );
  for (const id of ids) {
    sql(`insert into athlete_disciplines (athlete_id, discipline, is_primary)
         values ('${id}', '100 m', true)`);
  }
  const idOf = (n: number) => ids[n]!;

  // A competition of its own: one 100 m with the four athletes, its predictions open for now.
  const competition = sql(`insert into competitions (slug, name, starts_on, ends_on)
    values ('sheet-${tag}', 'Meeting Feuille ${tag}', current_date, current_date + 1) returning id`);
  const slug = `sheet-100-${tag}`;
  const event =
    sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    values ('${competition}', '${slug}', '100 m', 'F', now() + interval '1 day',
            now() + interval '1 day') returning id`);
  sql(`insert into entries (event_id, athlete_id)
       select '${event}', id from athletes where slug like 'sheet-_-${tag}'`);

  const admin = newPlayer("sheet-admin");
  await page.goto("/connexion");
  await signUp(page, admin);
  const adminId = sql(`select id from auth.users where email = '${admin.email}'`);
  const rivalId = sql(`with u as (
      insert into auth.users (id, email)
      values (gen_random_uuid(), 'e2e-sheet-rival-${tag}@example.test') returning id
    )
    insert into profiles (id, pseudo, age_confirmed_at)
    select id, 'Rival Feuille ${tag}', now() from u returning id`);

  // The admin predicts Alpha, Bravo, Charlie.
  sql(`insert into predictions (user_id, event_id, p1, p2, p3)
       values ('${adminId}', '${event}', '${idOf(0)}', '${idOf(1)}', '${idOf(2)}')`);

  // A Manager league of two: closing the mercato draws one head-to-head on the competition. The
  // admin lines up Alpha, the rival Delta; then the event starts.
  const league = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids,
                        mercato_opened_at)
    select 'Feuille ${tag}', '${adminId}',
           rules || '{"lineup": {"max": 1, "minPerFamily": {}},
                      "bonuses": {"first": 50, "second": 30, "third": 20, "personal_best": 20,
                                  "season_best": 10, "national_record": 40, "area_record": 60,
                                  "world_record": 100}}',
           array['${competition}']::uuid[], now() - interval '3 days'
    from manager_rules returning id`);
  sql(`insert into manager_members (league_id, user_id)
       values ('${league}', '${adminId}'), ('${league}', '${rivalId}')`);
  sql(`update manager_leagues set mercato_closed_at = now() where id = '${league}'`);
  sql(`insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
       values ('${league}', '${competition}', '${adminId}', array['${idOf(0)}']::uuid[]),
              ('${league}', '${competition}', '${rivalId}', array['${idOf(3)}']::uuid[])`);
  sql(`update events set starts_at = now() - interval '1 hour', lock_at = now() - interval '1 hour'
       where id = '${event}'`);
  sql(`update profiles set is_admin = true where id = '${adminId}'`);

  // One sheet per event, reached from the event.
  await page.goto(`/admin/${slug}`);
  await page.getByRole("link", { name: "Saisir la feuille de résultats" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Feuille de résultats");

  // The lined-up athletes come first and are flagged until entered.
  const cards = page.locator("form ol > li");
  await expect(cards.nth(0)).toContainText("Aligné · à saisir");
  await expect(cards.nth(1)).toContainText("Aligné · à saisir");
  await expect(page.getByText("2 athlètes alignés sans performance (sur 2)")).toBeVisible();

  // A finisher with neither a place nor a mark is refused.
  const card = (name: string) => page.getByRole("listitem", { name, exact: true });
  await card(charlie).getByLabel("Statut").selectOption({ label: "Arrivé" });
  await page.getByRole("button", { name: "Enregistrer et calculer les points" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Un athlète arrivé a besoin d'une place ou d'une marque.",
  );

  // Alpha wins with a personal best, Bravo and Charlie complete the podium without a mark, Delta
  // finishes 4th.
  await card(alpha).getByLabel("Place").fill("1");
  await card(alpha).getByLabel("Marque").fill("10,9");
  await card(alpha).getByText("RP", { exact: true }).click();
  await card(bravo).getByLabel("Place").fill("2");
  await card(charlie).getByLabel("Place").fill("3");
  await card(delta).getByLabel("Place").fill("4");
  await card(delta).getByLabel("Marque").fill("11.50");
  await page.getByRole("button", { name: "Enregistrer et calculer les points" }).click();

  // Back on the event: the podium is drawn from the sheet and the prediction points are computed.
  await page.waitForURL(new RegExp(`/admin/${slug}\\?enregistre=1$`));
  await expect(page.getByText("✓ Points calculés pour 1 joueur.")).toBeVisible();
  expect(
    sql(`select string_agg(a.name || ':' || r.rank, ',' order by r.rank)
         from results r join athletes a on a.id = r.athlete_id where r.event_id = '${event}'`),
  ).toBe(`${alpha}:1,${bravo}:2,${charlie}:3`);
  expect(
    sql(`select count(*) from admin_actions
         where action = 'run_manager_scoring' and admin_id = '${adminId}'`),
  ).toBe("1");

  // As a player: the prediction points on the event...
  sql(`update profiles set is_admin = false where id = '${adminId}'`);
  await page.goto(`/epreuves/${slug}`);
  await expect(page.locator('main:not([aria-busy="true"])')).toContainText("+12 pts");

  // ...and the score of the head-to-head in the Manager league.
  const mine = worldAthleticsPoints("100 m", "F", 10.9)! + 50 + 20 + 12;
  const theirs = worldAthleticsPoints("100 m", "F", 11.5)!;
  await page.goto(`/manager/${league}/journee/1`);
  await page
    .getByRole("listitem", { name: "Ma confrontation" })
    .getByRole("link", { name: /Voir la confrontation/ })
    .click();
  const summary = page.getByRole("region", { name: "Résultat de la confrontation" });
  await expect(summary).toContainText("Victoire +3");
  // The scores are on the stadiums (#775): the rival's at the top, « Mon stade » at the bottom.
  const stadium = page.getByRole("region", { name: "Le stade de la confrontation" });
  await expect(stadium.getByText(`${theirs} - ${mine}`)).toBeVisible();
  await expect(stadium.getByRole("heading", { name: /^Mon stade/ })).toContainText(`${mine}`);

  sql(`delete from manager_leagues where id = '${league}'`);
  sql(`delete from competitions where id = '${competition}'`);
  sql(`delete from athletes where slug like 'sheet-_-${tag}'`);
  sql(`delete from auth.users where id = '${rivalId}'`);
});
