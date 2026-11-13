import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("an admin enters the marks and records of every athlete, the lined-up ones flagged first", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const [aligned, other, third] = ["Alpha", "Bravo", "Charlie"].map((n) => `${n} Perf ${tag}`);
  for (const [n, name] of [aligned, other, third].entries()) {
    sql(`insert into athletes (slug, name, country_code, gender)
         values ('perf-${n}-${tag}', '${name}', 'FRA', 'F')`);
  }
  // A competition of its own: one 100 m with the three athletes, its predictions open for now.
  const competition = sql(`insert into competitions (slug, name, starts_on, ends_on)
    values ('perf-${tag}', 'Meeting Perf ${tag}', current_date, current_date + 1) returning id`);
  const slug = `perf-100-${tag}`;
  const event =
    sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    values ('${competition}', '${slug}', '100 m', 'F', now() + interval '1 day',
            now() + interval '1 day') returning id`);
  sql(`insert into entries (event_id, athlete_id)
       select '${event}', id from athletes where slug like 'perf-_-${tag}'`);

  const admin = newPlayer("perf-admin");
  await page.goto("/connexion");
  await signUp(page, admin);
  const adminId = sql(`select id from auth.users where email = '${admin.email}'`);
  sql(`update profiles set is_admin = true where id = '${adminId}'`);

  // A Manager participant lines up Alpha before the start; then the event starts.
  const league = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids,
                        mercato_opened_at, mercato_closed_at)
    values ('Perf ${tag}', '${adminId}', '{"lineup": {"max": 1, "minPerFamily": {}}}',
            array['${competition}']::uuid[], now() - interval '3 days', now() - interval '1 day')
    returning id`);
  sql(`insert into manager_members (league_id, user_id) values ('${league}', '${adminId}')`);
  sql(`insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
       select '${league}', '${competition}', '${adminId}', array[id]
       from athletes where slug = 'perf-0-${tag}'`);
  sql(`update events set starts_at = now() - interval '1 hour', lock_at = now() - interval '1 hour'
       where id = '${event}'`);

  await page.goto(`/admin/${slug}`);
  await page.getByRole("link", { name: "Performances Manager" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Performances");

  // The lined-up athlete comes first and is flagged until entered.
  const cards = page.locator("form ol > li");
  await expect(cards.first()).toHaveAccessibleName(aligned);
  await expect(cards.first()).toContainText("Aligné · à saisir");
  await expect(page.getByText("1 athlète aligné attend une performance (sur 1).")).toBeVisible();

  // A finisher without a mark is refused.
  const charlie = page.getByRole("listitem", { name: third });
  await charlie.getByLabel("Place").fill("3");
  await page.getByRole("button", { name: "Enregistrer les performances" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Un athlète arrivé a besoin de sa marque.",
  );

  // Alpha wins with a personal best; Bravo does not finish; Charlie is left out.
  await charlie.getByLabel("Place").fill("");
  await charlie.getByLabel("Statut").selectOption({ label: "Non saisi" });
  const alpha = page.getByRole("listitem", { name: aligned });
  await alpha.getByLabel("Place").fill("1");
  await alpha.getByLabel("Marque").fill("10,9");
  await alpha.getByText("RP", { exact: true }).click();
  await expect(alpha.getByRole("checkbox", { name: "Record personnel" })).toBeChecked();
  await page
    .getByRole("listitem", { name: other })
    .getByLabel("Statut")
    .selectOption({ label: "Abandon (DNF)" });
  await page.getByRole("button", { name: "Enregistrer les performances" }).click();

  await expect(page.getByText("✓ Performances enregistrées : 2 athlètes.")).toBeVisible();
  await expect(page.getByText("✓ L'athlète aligné a une performance.")).toBeVisible();
  await expect(alpha.getByLabel("Marque")).toHaveValue("10.90");
  await expect(alpha.getByRole("checkbox", { name: "Record personnel" })).toBeChecked();
  await expect(page.getByRole("listitem", { name: other }).getByLabel("Statut")).toHaveValue("dnf");
  expect(
    sql(`select count(*) from admin_actions
         where action = 'set_performances' and event_id = '${event}' and admin_id = '${adminId}'`),
  ).toBe("1");

  sql(`delete from manager_leagues where id = '${league}'`);
  sql(`delete from competitions where id = '${competition}'`);
  sql(`delete from athletes where slug like 'perf-_-${tag}'`);
});
