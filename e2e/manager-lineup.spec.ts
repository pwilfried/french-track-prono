import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { chooseSeason, createLeague, seasonReady } from "./manager-season";
import { newPlayer, signUp } from "./players";

test("a participant lines up their team before a competition and can no longer change it once it has started", async ({
  page,
}) => {
  seasonReady();
  const tag = `${Date.now() % 1000000}`;
  const league = `Alignement ${tag}`;
  const meeting = `Meeting Alignement ${tag}`;
  const athletes = [
    ["sprint", `Sprint Align ${tag}`, "100 m"],
    ["haies", `Haies Align ${tag}`, "100 m haies"],
    ["demi", `Demi Align ${tag}`, "800 m"],
    ["saut", `Saut Align ${tag}`, "Saut en longueur"],
    ["poids", `Poids Align ${tag}`, "Lancer du poids"],
  ] as const;
  for (const [key, name, discipline] of athletes) {
    sql(`insert into athletes (slug, name, country_code, gender, manager_price)
         values ('align-${key}-${tag}', '${name}', 'FRA', 'F', 10)`);
    sql(`insert into athlete_disciplines (athlete_id, discipline, is_primary)
         select id, '${discipline}', true from athletes where slug = 'align-${key}-${tag}'`);
  }
  const [sprinter, hurdler, runner, jumper, thrower] = athletes.map(([, name]) => name);

  // An eligible competition whose first event locks in two days; the thrower is not entered.
  const competition = sql(`insert into competitions (slug, name, starts_on, ends_on)
    values ('align-${tag}', '${meeting}', current_date + 2, current_date + 2) returning id`);
  const event =
    sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    values ('${competition}', 'align-100-${tag}', '100 m', 'F', now() + interval '2 days',
            now() + interval '2 days') returning id`);
  sql(`insert into entries (event_id, athlete_id)
       select '${event}', id from athletes
       where slug in ('align-sprint-${tag}', 'align-haies-${tag}', 'align-demi-${tag}',
                      'align-saut-${tag}')`);

  // A second competition with no start list yet: none of the team is entered (#839).
  const bare = `Meeting Vide ${tag}`;
  const bareCompetition = sql(`insert into competitions (slug, name, starts_on, ends_on)
    values ('align-bare-${tag}', '${bare}', current_date + 3, current_date + 3) returning id`);
  sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    values ('${bareCompetition}', 'align-bare-100-${tag}', '100 m', 'F', now() + interval '3 days',
            now() + interval '3 days')`);

  const owner = newPlayer("lineup-owner");
  await page.goto("/manager/creer");
  await signUp(page, owner);
  await page.waitForURL(/\/manager\/creer$/);
  await page.getByLabel("Nom de la ligue").fill(league);
  await chooseSeason(page);
  await createLeague(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(league);
  const id = sql(`select id from manager_leagues where name = '${league}'`);

  // The mercato is over: the five athletes are the owner's team. Four places, one per family:
  // sprint, distance, jumps, throws.
  sql(`update manager_leagues
       set rules = rules || '{"lineup": {"max": 4, "perFamily": 1, "bench": 0}}',
           competition_ids = array['${competition}', '${bareCompetition}']::uuid[],
           mercato_opened_at = now() - interval '3 days', mercato_closed_at = now()
       where id = '${id}'`);
  sql(`insert into manager_rounds (league_id, round, ends_at) values ('${id}', 1, now())`);
  sql(`insert into manager_awards (league_id, athlete_id, user_id, amount, round)
       select '${id}', a.id, l.owner_id, 10, 1
       from athletes a, manager_leagues l
       where a.slug like 'align-%-${tag}' and l.id = '${id}'`);

  // From the league to the competitions, then to the stadium.
  await page.reload();
  await page.getByRole("main").getByRole("link", { name: "Mon alignement" }).click();
  await expect(page).toHaveURL(new RegExp(`/manager/${id}/alignement$`));

  // Nobody entered in the bare competition: the screen says so, no empty lineup to validate.
  await page.getByRole("link", { name: new RegExp(bare) }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(bare);
  await expect(page.getByText("0/4 places")).toBeVisible();
  await expect(
    page.getByText("Aucun de tes athlètes n'est inscrit à cette compétition pour l'instant."),
  ).toBeVisible();
  await expect(page.getByText("Toutes les places sont remplies.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Valider mon alignement" })).toHaveCount(0);
  await page.getByRole("link", { name: "Mon alignement" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/manager/${id}/alignement$`));
  const row = page.getByRole("link", { name: new RegExp(meeting) });
  await expect(row).toContainText("À aligner");
  await row.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(meeting);

  // The thrower is not entered: greyed on the bench.
  const bench = page.getByRole("list", { name: "Remplaçants" });
  await expect(bench.getByRole("article", { name: new RegExp(thrower) })).toContainText("Absent·e");
  await expect(bench.getByRole("button", { name: thrower })).toHaveCount(0);

  const validate = page.getByRole("button", { name: "Valider mon alignement" });
  await expect(validate).toBeDisabled();
  await expect(page.getByText("À remplir : Sprint, Demi-fond et fond, Sauts")).toBeVisible();

  // Tap a spot of the stadium, then pick an athlete in the sheet: only those who fit are listed.
  const sheet = page.getByRole("dialog");
  await page.getByRole("button", { name: "Place Sprint, vide" }).click();
  await expect(sheet.getByRole("heading", { name: "Place Sprint" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: new RegExp(runner) })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: new RegExp(thrower) })).toHaveCount(0);
  await sheet.getByRole("button", { name: new RegExp(sprinter) }).click();
  await expect(
    page.getByRole("button", { name: `Place Sprint : ${sprinter}, changer` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Place Demi-fond et fond, vide" }).click();
  await sheet.getByRole("button", { name: new RegExp(runner) }).click();
  await page.getByRole("button", { name: "Place Sauts, vide" }).click();
  await sheet.getByRole("button", { name: new RegExp(jumper) }).click();
  await expect(page.getByText("3/4 places")).toBeVisible();
  // Nobody entered can take the throws place: it stays empty without blocking.
  await expect(
    page.getByText("Toutes les places que ton équipe peut remplir sont remplies."),
  ).toBeVisible();

  await validate.click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "✓ Alignement validé, modifiable jusqu'au verrouillage.",
  );
  expect(
    sql(`select cardinality(athlete_ids) from manager_lineups
         where league_id = '${id}' and competition_id = '${competition}'`),
  ).toBe("3");

  // Changed until the lock: the hurdler takes the sprint place, the jumper goes back to the bench
  // and the lineup is no longer complete.
  await page.reload();
  await expect(page.getByText("3/4 places")).toBeVisible();
  await page.getByRole("button", { name: `Place Sprint : ${sprinter}, changer` }).click();
  await sheet.getByRole("button", { name: new RegExp(hurdler) }).click();
  await expect(
    page.getByRole("button", { name: `Place Sprint : ${hurdler}, changer` }),
  ).toBeVisible();
  await page.getByRole("button", { name: `Place Sauts : ${jumper}, changer` }).click();
  await sheet.getByRole("button", { name: "Retirer de cette place" }).click();
  await expect(validate).toBeDisabled();

  // The competition starts: the stadium reads only.
  sql(`update events set lock_at = now() - interval '1 minute', starts_at = now() - interval '1 minute'
       where id = '${event}'`);
  await page.reload();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "🔒 Verrouillé : la compétition a commencé.",
  );
  await expect(page.getByRole("button", { name: "Valider mon alignement" })).toHaveCount(0);
  await expect(page.getByText(`Place Sprint : ${sprinter}`)).toBeAttached();

  await page.getByRole("link", { name: "Mon alignement" }).first().click();
  await expect(page.getByRole("link", { name: new RegExp(meeting) })).toContainText("Verrouillé");
});
