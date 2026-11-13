import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a participant reads the matchday results and the Manager standings, bonus matchday aside", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const player = newPlayer("mchamp");
  await page.goto("/connexion");
  await signUp(page, player);
  const playerId = sql(`select id from auth.users where email = '${player.email}'`);
  const rivalPseudo = `Rival ${tag}`;
  const rivalId = sql(`with u as (
      insert into auth.users (id, email)
      values (gen_random_uuid(), 'e2e-mchamp-rival-${tag}@example.test') returning id
    )
    insert into profiles (id, pseudo, age_confirmed_at)
    select id, '${rivalPseudo}', now() from u returning id`);

  // Three competitions a day apart: two head-to-head matchdays for two players, then a bonus one.
  const competitions = [1, 2, 3].map((day) => {
    const id = sql(`insert into competitions (slug, name, starts_on, ends_on)
      values ('mchamp-${day}-${tag}', 'Meeting Champ ${day} ${tag}', current_date + ${day},
              current_date + ${day}) returning id`);
    sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
         values ('${id}', 'mchamp-100-${day}-${tag}', '100 m', 'F',
                 now() + interval '${day} days', now() + interval '${day} days')`);
    return id;
  });
  const league = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids)
    select 'Championnat ${tag}', '${playerId}', rules,
           array['${competitions.join("','")}']::uuid[]
    from manager_rules returning id`);
  sql(`insert into manager_members (league_id, user_id)
       values ('${league}', '${playerId}'), ('${league}', '${rivalId}')`);
  // Closing the mercato draws the schedule.
  sql(`update manager_leagues set mercato_opened_at = now() - interval '2 days',
         mercato_closed_at = now() where id = '${league}'`);
  // Matchday 1 is scored: the player wins 900 – 700. The rival scores 5000 on the bonus matchday.
  sql(`insert into manager_scores (league_id, competition_id, user_id, lined_up, total, hungarian,
                                   bonus, predictions)
       values ('${league}', '${competitions[0]}', '${playerId}', true, 900, 900, 0, 0),
              ('${league}', '${competitions[0]}', '${rivalId}', true, 700, 700, 0, 0),
              ('${league}', '${competitions[2]}', '${rivalId}', true, 5000, 5000, 0, 0)`);

  // The standings: the bonus matchday gives no championship point.
  await page.goto(`/manager/${league}`);
  await page.getByRole("main").getByRole("link", { name: "Classement", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Classement");
  const rows = page.getByRole("table", { name: "Classement du championnat" }).getByRole("row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText(player.pseudo);
  await expect(rows.nth(1).getByRole("cell")).toHaveText(["1", "1", "0", "0", "+200", "3"]);
  await expect(rows.nth(2)).toContainText(rivalPseudo);
  await expect(rows.nth(2).getByRole("cell")).toHaveText(["2", "0", "0", "1", "-200", "0"]);
  const next = page.getByRole("region", { name: "Journée 2 · le choc" });
  await expect(next).toContainText(`Meeting Champ 2 ${tag}`);
  await expect(next).toContainText(rivalPseudo);

  // The calendar opens on the first matchday not played yet.
  await next.getByRole("link", { name: "Voir le calendrier" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Journée 2");
  await expect(page.getByRole("link", { name: "Journée 2", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Matchday 1: the player's head-to-head, won.
  await page.getByRole("link", { name: "Journée 1", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Journée 1");
  await expect(
    page.getByText(`Meeting Champ 1 ${tag} · Aller · 1 confrontation · Terminée`),
  ).toBeVisible();
  const mine = page.getByRole("listitem", { name: "Ma confrontation" });
  await expect(mine).toContainText("900");
  await expect(mine).toContainText("700");
  await expect(mine).toContainText(/Victoire (à domicile|à l'extérieur) · \+3/);

  // Matchday 3: a bonus one, without head-to-head.
  await page.getByRole("link", { name: "Journée 3", exact: true }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Journée bonus : chacun marque ses points Manager, sans confrontation ni points au classement.",
  );
  await expect(page.getByRole("listitem", { name: "Ma confrontation" })).toHaveCount(0);

  sql(`delete from manager_leagues where id = '${league}'`);
  sql(`delete from competitions where id in ('${competitions.join("','")}')`);
  sql(`delete from auth.users where id = '${rivalId}'`);
});
