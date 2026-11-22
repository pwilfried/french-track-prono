import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a participant opens their head-to-head from the matchday and sees both lineups on the stadium", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const player = newPlayer("mduel");
  await page.goto("/connexion");
  await signUp(page, player);
  const playerId = sql(`select id from auth.users where email = '${player.email}'`);
  const rivalPseudo = `Rival Duel ${tag}`;
  const rivalId = sql(`with u as (
      insert into auth.users (id, email)
      values (gen_random_uuid(), 'e2e-mduel-rival-${tag}@example.test') returning id
    )
    insert into profiles (id, pseudo, age_confirmed_at)
    select id, '${rivalPseudo}', now() from u returning id`);

  // Eight athletes each: a stadium of 8 places, two per family (the default rules, #1030).
  const disciplines = [
    "100 m",
    "800 m",
    "Lancer du poids",
    "Saut en longueur",
    "5000 m",
    "Saut en hauteur",
    "Javelot",
  ];
  // One statement per player: in pre-production each one costs an API call and a cache flush (#840).
  const athletes = (who: string) => {
    const rows = [...disciplines, "200 m"].map((discipline, n) => `(${n}, '${discipline}')`);
    return sql(`with d (n, discipline) as (values ${rows.join(", ")}),
      a as (
        insert into athletes (slug, name, country_code, gender, manager_price)
        select 'mduel-${who}-' || n || '-${tag}', 'Duel${who} Athlete' || n || ' ${tag}', 'FRA', 'F', 10
        from d returning id, slug
      ),
      ad as (
        insert into athlete_disciplines (athlete_id, discipline, is_primary)
        select a.id, d.discipline, true from a join d on a.slug = 'mduel-${who}-' || d.n || '-${tag}'
      )
      select string_agg(a.id::text, ',' order by d.n)
      from a join d on a.slug = 'mduel-${who}-' || d.n || '-${tag}'`).split(",");
  };
  const mine = athletes("me");
  const theirs = athletes("rival");
  // A substitute on the player's bench: she came in for the shot putter, who did not finish (#1036).
  const substitute = sql(`with a as (
      insert into athletes (slug, name, country_code, gender, manager_price)
      values ('mduel-me-sub-${tag}', 'Duelme Remplaçante ${tag}', 'FRA', 'F', 10) returning id
    ), ad as (
      insert into athlete_disciplines (athlete_id, discipline, is_primary)
      select id, 'Lancer du poids', true from a
    )
    select id from a`);

  // Two competitions a day apart: one head-to-head each way.
  const competitions = [1, 2].map((day) => {
    const id = sql(`insert into competitions (slug, name, starts_on, ends_on)
      values ('mduel-${day}-${tag}', 'Meeting Duel ${day} ${tag}', current_date + ${day},
              current_date + ${day}) returning id`);
    sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
         values ('${id}', 'mduel-100-${day}-${tag}', '100 m', 'F',
                 now() + interval '${day} days', now() + interval '${day} days')`);
    return id;
  });
  const league = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids)
    select 'Confrontation ${tag}', '${playerId}', rules,
           array['${competitions.join("','")}']::uuid[]
    from manager_rules returning id`);
  sql(`insert into manager_members (league_id, user_id)
       values ('${league}', '${playerId}'), ('${league}', '${rivalId}')`);
  // Closing the mercato draws the schedule.
  sql(`update manager_leagues set mercato_opened_at = now() - interval '2 days',
         mercato_closed_at = now() where id = '${league}'`);
  // Both line up for the first competition before it starts; then it starts.
  const uuids = (ids: string[]) => `array['${ids.join("','")}']::uuid[]`;
  sql(`insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
       values ('${league}', '${competitions[0]}', '${playerId}', ${uuids(mine)}),
              ('${league}', '${competitions[0]}', '${rivalId}', ${uuids(theirs)})`);
  sql(`update events set lock_at = now() - interval '1 hour', starts_at = now() - interval '1 hour'
       where competition_id = '${competitions[0]}'`);
  // Scored: the player wins 930 – 812; their first athlete is at 0.
  const detail = (ids: string[], first: number) =>
    JSON.stringify(
      ids.map((id, n) => ({
        athlete_id: id,
        total: n === 0 ? first : 100,
        bonus_points: n === 1 ? 20 : 0,
      })),
    );
  const myDetail = JSON.parse(detail(mine, 0));
  myDetail[2] = {
    athlete_id: substitute,
    discipline: "Lancer du poids",
    mark: "15.20",
    status: "ok",
    points: 100,
    bonuses: [],
    bonus_points: 0,
    total: 100,
    substitution: {
      starter_id: mine[2],
      reason: "forfeit",
      starter: { mark: null, status: "dnf", total: 0, threshold: null },
    },
  };
  sql(`insert into manager_scores (league_id, competition_id, user_id, lined_up, total, hungarian,
                                   bonus, predictions, athletes)
       values ('${league}', '${competitions[0]}', '${playerId}', true, 930, 910, 20, 0,
               '${JSON.stringify(myDetail)}'),
              ('${league}', '${competitions[0]}', '${rivalId}', true, 812, 792, 20, 0,
               '${detail(theirs, 100)}')`);

  // From the matchday to the head-to-head.
  await page.goto(`/manager/${league}/journee/1`);
  await page
    .getByRole("listitem", { name: "Ma confrontation" })
    .getByRole("link", { name: /Voir la confrontation/ })
    .click();
  // A client-side navigation: no « load » event to wait for (#840).
  await expect(page).toHaveURL(/\/confrontation\//, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confrontation");
  await expect(page.getByText("Journée 1 · terminée")).toBeVisible();

  const summary = page.getByRole("region", { name: "Résultat de la confrontation" });
  await expect(summary).toContainText("Victoire +3");
  await expect(summary).toContainText(`Aller · `);
  // The predictions do not count in the Manager (#1031).
  await expect(summary).not.toContainText("Pronos");

  // Stadium against stadium: the rival's at the top, « Mon stade » at the bottom, 812 - 930.
  const stadium = page.getByRole("region", { name: "Le stade de la confrontation" });
  await expect(
    stadium.getByRole("heading", { name: new RegExp(`^Stade de ${rivalPseudo}`) }),
  ).toContainText("812");
  await expect(stadium.getByRole("heading", { name: /^Mon stade/ })).toContainText("930");
  await expect(stadium.getByText("812 - 930")).toBeVisible();
  await expect(stadium.getByRole("article")).toHaveCount(16);
  await expect(
    stadium.getByRole("list", { name: `Alignement de ${rivalPseudo}` }).getByRole("article"),
  ).toHaveCount(8);
  const myCards = stadium
    .getByRole("list", { name: `Alignement de ${player.pseudo}` })
    .getByRole("article");
  await expect(myCards).toHaveCount(8);
  // Each card reads its points, bonus included; the rival wins the duel of the first place.
  const myList = stadium.getByRole("list", { name: `Alignement de ${player.pseudo}` });
  await expect(myList.getByRole("article", { name: /, 0\spt$/ })).toHaveCount(1);
  await expect(myList.getByRole("article", { name: /dont 20 de bonus$/ })).toHaveCount(1);
  await expect(
    stadium
      .getByRole("list", { name: `Alignement de ${rivalPseudo}` })
      .getByRole("article")
      .filter({ hasText: "▲" }),
  ).toHaveCount(1);
  await expect(myCards.filter({ hasText: "▲" })).toHaveCount(0);

  // The header gives both scores and the result; the substitute stands on the shot putter's place,
  // « ↻ » on her card, and « Place par place » says what happened (#1036).
  const scores = page.getByLabel("Scores de la confrontation");
  await expect(scores).toContainText("812");
  await expect(scores).toContainText("930");
  await expect(scores).toContainText("Victoire");
  await expect(
    stadium.getByText("Tables ÷ 10 + bonus. ▲ : duel gagné à cette place."),
  ).toBeVisible();
  const substituteCard = myList.getByRole("article", {
    name: new RegExp(`^Duelme Remplaçante ${tag}.*entré·e à la place de Duelme Athlete2 ${tag}$`),
  });
  await expect(substituteCard).toContainText("↻");
  const places = page.getByRole("list", { name: "Place par place" }).getByRole("listitem");
  await expect(places).toHaveCount(8);
  await expect(places.filter({ hasText: `Duelme Remplaçante ${tag}` })).toContainText(
    `↻ Duelme Athlete2 ${tag} n'a pas terminé (DNF). Duelme Remplaçante ${tag}, son remplaçant, est entré·e.`,
  );

  await page.getByRole("link", { name: "Classement ›" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Classement");

  sql(`delete from manager_leagues where id = '${league}'`);
  sql(`delete from competitions where id in ('${competitions.join("','")}')`);
  sql(`delete from athletes where slug like 'mduel-%-${tag}'`);
  sql(`delete from auth.users where id = '${rivalId}'`);
});
