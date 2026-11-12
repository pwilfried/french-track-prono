import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, openManagerTo, signUp } from "./players";

test("a participant sees their team fixed for the season after the mercato, and what it misses", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const league = `Équipe ${tag}`;
  const sprinter = `Sprint Équipe ${tag}`;
  const hurdler = `Haies Équipe ${tag}`;
  for (const [slug, name, discipline] of [
    [`equipe-sprint-${tag}`, sprinter, "100 m"],
    [`equipe-haies-${tag}`, hurdler, "100 m haies"],
  ] as const) {
    sql(`insert into athletes (slug, name, country_code, gender, manager_price)
         values ('${slug}', '${name}', 'FRA', 'F', 10)`);
    sql(`insert into athlete_disciplines (athlete_id, discipline, is_primary)
         select id, '${discipline}', true from athletes where slug = '${slug}'`);
  }
  const owner = newPlayer("team-owner");

  // A league whose mercato closed with two athletes won, of three; no thrower was left.
  await page.goto("/manager/creer");
  await signUp(page, owner);
  await page.waitForURL(/\/manager\/creer$/);
  openManagerTo(owner);
  await page.reload();
  await page.getByLabel("Nom de la ligue").fill(league);
  await page.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(league);
  const id = sql(`select id from manager_leagues where name = '${league}'`);
  sql(`update manager_leagues
       set rules = rules || '{"budget": 100, "minTeamSize": 3, "quotas": [
             {"sex": "F", "family": "sprint", "min": 1, "max": 1},
             {"sex": "F", "family": "hurdles", "min": 0, "max": 1},
             {"sex": "F", "family": "throws", "min": 1, "max": 1}]}',
           mercato_opened_at = now() - interval '3 days', mercato_closed_at = now()
       where id = '${id}'`);
  sql(`insert into manager_rounds (league_id, round, ends_at) values ('${id}', 1, now())`);
  sql(`insert into manager_awards (league_id, athlete_id, user_id, amount, round)
       select '${id}', a.id, l.owner_id, p.amount, 1
       from athletes a, manager_leagues l,
            (values ('equipe-sprint-${tag}', 25), ('equipe-haies-${tag}', 15)) p(slug, amount)
       where a.slug = p.slug and l.id = '${id}'`);

  // From the league, to the team.
  await page.reload();
  await page.getByRole("main").getByRole("link", { name: "Mon équipe" }).click();
  await expect(page).toHaveURL(new RegExp(`/manager/${id}/equipe$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mon équipe");

  const summary = page.getByRole("region", { name: "Résumé de mon équipe" });
  await expect(summary).toContainText("Effectif2 athlètes");
  await expect(summary).toContainText("Crédits dépensés40 cr.");
  await expect(summary).toContainText("Crédits restants60 cr.");
  await expect(summary).toContainText("Équipe fixe pour la saison");

  // Sprint and hurdles share a group; each card shows the price paid.
  const sprint = page.getByRole("list", { name: "Sprint et haies" });
  await expect(sprint.getByRole("article")).toHaveCount(2);
  await expect(
    sprint.getByRole("article", { name: `${sprinter}, 100 m, payé 25 crédits` }),
  ).toContainText("SPR");
  await expect(
    sprint.getByRole("article", { name: `${hurdler}, 100 m haies, payé 15 crédits` }),
  ).toContainText("15 cr.");

  // No compliance badge: a concrete message, and the team plays all the same.
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Ton équipe compte 2 athlètes au lieu de 3 : il ne restait plus aucune lanceuse libre à la fin du mercato. Tu joues quand même.",
  );
  await expect(page.getByText(/non conforme/i)).toHaveCount(0);

  // Nothing to buy, sell or swap in v1.
  await expect(
    page.getByRole("main").getByRole("button", { name: /acheter|vendre|échanger|remplacer/i }),
  ).toHaveCount(0);
});
