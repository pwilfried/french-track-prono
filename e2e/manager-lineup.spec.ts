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
  await expect(page.getByLabel("0 places remplies sur 4")).toBeVisible();
  await expect(
    page.getByText("Aucun de tes athlètes n'est inscrit à cette compétition pour l'instant."),
  ).toBeVisible();
  await expect(page.getByText("Toutes les places sont remplies.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Valider mon alignement" })).toHaveCount(0);
  await page.goto(`/manager/${id}/alignement`);
  const row = page.getByRole("link", { name: new RegExp(meeting) });
  await expect(row).toContainText("À aligner");
  await row.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(meeting);

  // No bench in this league; the thrower is not entered: greyed in the reserve.
  await expect(
    page.getByText("Pas de banc dans cette ligue : seuls les titulaires jouent."),
  ).toBeVisible();
  await page.getByText("Réserve · 5").click();
  const reserve = page.getByRole("list", { name: "Réserve · 5" });
  await expect(reserve.getByRole("listitem").filter({ hasText: thrower })).toContainText(
    "Absent·e",
  );

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
  await expect(page.getByLabel("3 places remplies sur 4")).toBeVisible();
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

  // Changed until the lock: the hurdler takes the sprint place, the jumper goes back to the
  // reserve and the lineup is no longer complete.
  await page.reload();
  await expect(page.getByLabel("3 places remplies sur 4")).toBeVisible();
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

  await page.goto(`/manager/${id}/alignement`);
  await expect(page.getByRole("link", { name: new RegExp(meeting) })).toContainText("Verrouillé");
});

test("a participant fills the match sheet: eight starters, four ordered substitutes and a tactical threshold, kept after a reload", async ({
  page,
}) => {
  // About fifty round trips (sign-up, a dozen athletes, eight places, the bench): on the slow
  // pre-production base this brushed the 120 s limit (#1065).
  test.slow();
  seasonReady();
  const tag = `${Date.now() % 1000000}`;
  const league = `Feuille ${tag}`;
  const meeting = `Meeting Feuille ${tag}`;
  // Three athletes per family: two start, the third sits on the bench.
  const athletes = [
    ["s1", "100 m"],
    ["s2", "200 m"],
    ["s3", "100 m"],
    ["d1", "800 m"],
    ["d2", "1500 m"],
    ["d3", "800 m"],
    ["j1", "Saut en longueur"],
    ["j2", "Triple saut"],
    ["j3", "Saut en longueur"],
    ["t1", "Lancer du poids"],
    ["t2", "Lancer du disque"],
    ["t3", "Lancer du poids"],
  ] as const;
  const nameOf = (key: string) => `Feuille ${key.toUpperCase()} ${tag}`;
  const competition = sql(`insert into competitions (slug, name, starts_on, ends_on)
    values ('sheet-${tag}', '${meeting}', current_date + 2, current_date + 2) returning id`);
  for (const [key, discipline] of athletes) {
    sql(`insert into athletes (slug, name, country_code, gender, manager_price)
         values ('sheet-${key}-${tag}', '${nameOf(key)}', 'FRA', 'F', 10)`);
    sql(`insert into athlete_disciplines (athlete_id, discipline, is_primary)
         select id, '${discipline}', true from athletes where slug = 'sheet-${key}-${tag}'`);
  }
  for (const discipline of new Set(athletes.map(([, d]) => d))) {
    const event =
      sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      values ('${competition}', 'sheet-${tag}-' || md5('${discipline}'), '${discipline}', 'F',
              now() + interval '2 days', now() + interval '2 days') returning id`);
    sql(`insert into entries (event_id, athlete_id)
         select '${event}', a.id from athletes a join athlete_disciplines d on d.athlete_id = a.id
         where a.slug like 'sheet-%-${tag}' and d.discipline = '${discipline}'`);
  }

  const owner = newPlayer("sheet-owner");
  await page.goto("/manager/creer");
  await signUp(page, owner);
  await page.waitForURL(/\/manager\/creer$/);
  await page.getByLabel("Nom de la ligue").fill(league);
  await chooseSeason(page);
  await createLeague(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(league);
  const id = sql(`select id from manager_leagues where name = '${league}'`);
  sql(`update manager_leagues
       set rules = rules || '{"lineup": {"max": 8, "perFamily": 2, "bench": 4}}',
           competition_ids = array['${competition}']::uuid[],
           mercato_opened_at = now() - interval '3 days', mercato_closed_at = now()
       where id = '${id}'`);
  sql(`insert into manager_rounds (league_id, round, ends_at) values ('${id}', 1, now())`);
  sql(`insert into manager_awards (league_id, athlete_id, user_id, amount, round)
       select '${id}', a.id, l.owner_id, 10, 1
       from athletes a, manager_leagues l
       where a.slug like 'sheet-%-${tag}' and l.id = '${id}'`);

  await page.goto(`/manager/${id}/alignement/sheet-${tag}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(meeting);
  await expect(page.getByText("À valider")).toBeVisible();
  const sheet = page.getByRole("dialog");

  // Eight starters, two per family.
  const places = [
    ["Sprint", "s1"],
    ["Sprint", "s2"],
    ["Demi-fond et fond", "d1"],
    ["Demi-fond et fond", "d2"],
    ["Sauts", "j1"],
    ["Sauts", "j2"],
    ["Lancers", "t1"],
    ["Lancers", "t2"],
  ] as const;
  for (const [place, key] of places) {
    await page
      .getByRole("button", { name: `Place ${place}, vide` })
      .first()
      .click();
    await sheet.getByRole("button", { name: new RegExp(nameOf(key)) }).click();
  }
  await expect(page.getByLabel("8 places remplies sur 8")).toBeVisible();

  // Four substitutes from the reserve, then the thrower comes in before the jumper.
  await page.getByText("Réserve · 4").click();
  for (const key of ["s3", "d3", "j3", "t3"]) {
    await page.getByRole("button", { name: `Mettre ${nameOf(key)} sur le banc` }).click();
  }
  await page.getByRole("button", { name: `Faire entrer ${nameOf("t3")} plus tôt` }).click();
  const bench = page.getByRole("list", { name: "Remplaçants" }).getByRole("listitem");
  await expect(bench).toHaveCount(4);
  await expect(bench.nth(2)).toContainText(nameOf("t3"));
  await expect(bench.nth(3)).toContainText(nameOf("j3"));

  // The sprinter's place: her substitute, who comes in if she runs slower than 11.50.
  await page.getByRole("button", { name: `Place Sprint : ${nameOf("s1")}, changer` }).click();
  await expect(sheet.getByRole("heading", { name: "Titulaire · Sprint" })).toBeVisible();
  await sheet.getByRole("radio", { name: new RegExp(nameOf("s3")) }).check();
  await sheet
    .getByRole("switch", { name: "Remplacement tactique si la performance déçoit" })
    .click();
  await sheet
    .getByLabel(`${nameOf("s3")} entre si ${nameOf("s1")} court plus lentement que`)
    .fill("11,50");
  await expect(sheet.getByText(/pts au barème/)).toBeVisible();
  await sheet.getByRole("button", { name: "Enregistrer" }).click();
  await expect(sheet).toBeHidden();
  await expect(bench.nth(0)).toContainText(/Remplace .* si plus lent que 11,50/);
  await expect(
    page.getByText("8 titulaires · 4 remplaçants · 1 remplacement tactique"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Valider mon alignement" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "✓ Alignement validé, modifiable jusqu'au verrouillage.",
  );
  expect(
    sql(`select count(*) from manager_lineup_entries
         where league_id = '${id}' and competition_id = '${competition}'`),
  ).toBe("12");

  // Everything is still there after a reload.
  await page.reload();
  await expect(page.getByText("Validé", { exact: true })).toBeVisible();
  await expect(page.getByLabel("8 places remplies sur 8")).toBeVisible();
  await expect(
    page.getByText("8 titulaires · 4 remplaçants · 1 remplacement tactique"),
  ).toBeVisible();
  await expect(bench).toHaveCount(4);
  for (const [i, key] of ["s3", "d3", "t3", "j3"].entries()) {
    await expect(bench.nth(i)).toContainText(nameOf(key));
  }
  await expect(bench.nth(0)).toContainText(/si plus lent que 11,50/);
  await page.getByRole("button", { name: `Place Sprint : ${nameOf("s1")}, changer` }).click();
  await expect(sheet.getByRole("radio", { name: new RegExp(nameOf("s3")) })).toBeChecked();
  await expect(
    sheet.getByLabel(`${nameOf("s3")} entre si ${nameOf("s1")} court plus lentement que`),
  ).toHaveValue("11,50");
});
