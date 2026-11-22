import { expect, test } from "@playwright/test";

import { worldAthleticsPoints } from "../src/domain/world-athletics-points";
import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("the admin recomputes the Manager points and the participant reads them, substitute included", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const meeting = `Meeting Points ${tag}`;
  const [winner, dropout, substitute] = [
    `Alpha Points ${tag}`,
    `Bravo Points ${tag}`,
    `Charlie Points ${tag}`,
  ];
  for (const [n, name] of [winner, dropout, substitute].entries()) {
    sql(`insert into athletes (slug, name, country_code, gender)
         values ('mpts-${n}-${tag}', '${name}', 'FRA', 'F')`);
  }
  const slug = `mpts-${tag}`;
  const competition = sql(`insert into competitions (slug, name, starts_on, ends_on)
    values ('${slug}', '${meeting}', current_date, current_date + 1) returning id`);
  const event =
    sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    values ('${competition}', 'mpts-100-${tag}', '100 m', 'F', now() + interval '1 day',
            now() + interval '1 day') returning id`);
  sql(`insert into entries (event_id, athlete_id)
       select '${event}', id from athletes where slug like 'mpts-_-${tag}'`);

  const admin = newPlayer("mpts-admin");
  await page.goto("/connexion");
  await signUp(page, admin);
  const adminId = sql(`select id from auth.users where email = '${admin.email}'`);
  sql(`update profiles set is_admin = true where id = '${adminId}'`);

  // A Manager league whose mercato is over: the admin plays it and lines up Alpha and Bravo before
  // the start, Charlie on the bench as Bravo's substitute (#1036); then the competition starts.
  const league = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids,
                        mercato_opened_at, mercato_closed_at)
    select 'Points ${tag}', '${adminId}',
           rules || '{"bonuses": {"first": 50, "second": 30, "third": 20, "personal_best": 20,
                                  "season_best": 10, "national_record": 40, "area_record": 60,
                                  "world_record": 100}}',
           array['${competition}']::uuid[], now() - interval '3 days', now() - interval '1 day'
    from manager_rules
    returning id`);
  sql(`insert into manager_members (league_id, user_id) values ('${league}', '${adminId}')`);
  sql(`insert into manager_rounds (league_id, round, ends_at) values ('${league}', 1, now())`);
  sql(`insert into manager_awards (league_id, athlete_id, user_id, amount, round)
       select '${league}', id, '${adminId}', 10, 1 from athletes where slug like 'mpts-_-${tag}'`);
  sql(`insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
       select '${league}', '${competition}', '${adminId}', array_agg(id order by slug)
       from athletes where slug in ('mpts-0-${tag}', 'mpts-1-${tag}')`);
  sql(`insert into manager_lineup_entries (league_id, competition_id, user_id, athlete_id, role,
                                           slot, discipline, substitute_id)
       select '${league}', '${competition}', '${adminId}', a.id,
              case when a.slug = 'mpts-2-${tag}' then 'substitute' else 'starter' end,
              case when a.slug = 'mpts-1-${tag}' then 2 else 1 end, '100 m',
              case when a.slug = 'mpts-1-${tag}' then s.id end
       from athletes a, athletes s
       where a.slug like 'mpts-_-${tag}' and s.slug = 'mpts-2-${tag}'`);
  sql(`update events set starts_at = now() - interval '1 hour', lock_at = now() - interval '1 hour'
       where id = '${event}'`);

  // Alpha wins with a personal best, Bravo does not finish, Charlie runs 11.30; the admin's
  // predictions earned 6, which the Manager does not count (#1031).
  sql(`insert into event_performances (event_id, athlete_id, status, place, mark, records)
       select '${event}', id, case when slug = 'mpts-1-${tag}' then 'dnf' else 'ok' end,
              case slug when 'mpts-0-${tag}' then 1 when 'mpts-2-${tag}' then 2 end,
              case slug when 'mpts-0-${tag}' then '10.90' when 'mpts-2-${tag}' then '11.30' end,
              case when slug = 'mpts-0-${tag}' then array['pb'] else '{}' end
       from athletes where slug like 'mpts-_-${tag}'`);
  sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason)
       values ('${adminId}', '${competition}', '${event}', 'prediction', 6, 'prediction')`);

  // Before the computation: nothing to show yet.
  await page.goto(`/manager/${league}/alignement/${slug}`);
  await page.getByRole("link", { name: "Mes points" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(meeting);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Les points de cette compétition ne sont pas encore calculés.",
  );

  // The admin runs the fallback computation of the competition (#665: every results sheet runs it
  // too; the performances here were written without a sheet).
  await page.goto(`/admin/competitions/${slug}`);
  await page.getByRole("button", { name: "Recalculer les points Manager" }).click();
  await expect(page.getByText("✓ Points Manager recalculés : 1 participant.")).toBeVisible();
  expect(
    sql(`select count(*) from admin_actions
         where action = 'run_manager_scoring' and admin_id = '${adminId}'`),
  ).toBe("1");

  // « Mes points »: its three figures (the tables divided by 10, the bonuses, the total), then the
  // athletes who counted from the strongest: Charlie came in for Bravo, who sits on the bench.
  const alphaTable = worldAthleticsPoints("100 m", "F", 10.9)!;
  const charlieTable = worldAthleticsPoints("100 m", "F", 11.3)!;
  const [alpha, charlie] = [Math.floor(alphaTable / 10), Math.floor(charlieTable / 10)];
  // Charlie came 2nd: the place bonuses are for a final, and this one is.
  const hungarian = alpha + charlie;
  const bonus = 70 + 30;
  await page.goto(`/manager/${league}/points/${slug}`);
  const summary = page.getByRole("region", { name: "Mon score de la compétition" });
  await expect(summary.getByRole("definition")).toHaveText([
    `${hungarian}`,
    `${bonus}`,
    `${hungarian + bonus}`,
  ]);
  await expect(summary).toContainText("divisée par 10 (arrondi en dessous)");
  const starters = page.getByRole("list", { name: "Mes titulaires" }).getByRole("listitem");
  await expect(starters).toHaveCount(2);
  await expect(starters.first()).toHaveAccessibleName(winner);
  await expect(starters.first()).toContainText("100 m · 10.90");
  await expect(starters.first()).toContainText(
    `${alphaTable.toLocaleString("fr-FR")} ÷ 10 = ${alpha}`,
  );
  await expect(starters.first()).toContainText("1re +50");
  await expect(starters.first()).toContainText("Record perso +20");
  await expect(starters.first()).toContainText(`${alpha + 70}`);
  await expect(starters.last()).toHaveAccessibleName(substitute);
  await expect(starters.last()).toContainText("100 m · 11.30");
  await expect(starters.last()).toContainText(`entré·e à la place de ${dropout} ↻`);
  const bench = page.getByRole("list", { name: "Sur le banc" }).getByRole("listitem");
  await expect(bench).toHaveCount(1);
  await expect(bench.first()).toHaveAccessibleName(dropout);
  await expect(bench.first()).toContainText(
    `Remplacé·e par ${substitute} ↻ : n'a pas terminé (DNF).`,
  );

  sql(`delete from manager_leagues where id = '${league}'`);
  sql(`delete from competitions where id = '${competition}'`);
  sql(`delete from athletes where slug like 'mpts-_-${tag}'`);
});
