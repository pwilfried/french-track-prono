import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("the admin pastes a World Athletics results table: the sheet is pre-filled, then saving scores the predictions", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  // An accent in the base, none in the pasted table; the surnames carry the tag to stay unique.
  const athletes = [
    { name: `Élodie Brévan${tag}`, pasted: `Elodie BREVAN${tag}` },
    { name: `Sacha Morel${tag}`, pasted: `Sacha MOREL${tag}` },
    { name: `Inès Garnier${tag}`, pasted: `Ines GARNIER${tag}` },
    { name: `Lou Perrin${tag}`, pasted: `Lou PERRIN${tag}` },
  ];
  const ids = athletes.map((a, n) =>
    sql(`insert into athletes (slug, name, country_code, gender)
         values ('paste-${n}-${tag}', '${a.name}', 'FRA', 'F') returning id`),
  );
  for (const id of ids) {
    sql(`insert into athlete_disciplines (athlete_id, discipline, is_primary)
         values ('${id}', '100 m', true)`);
  }
  const competition = sql(`insert into competitions (slug, name, starts_on, ends_on)
    values ('paste-${tag}', 'Meeting Collé ${tag}', current_date, current_date + 1) returning id`);
  const slug = `paste-100-${tag}`;
  const event =
    sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    values ('${competition}', '${slug}', '100 m', 'F', now() + interval '1 day',
            now() + interval '1 day') returning id`);
  sql(`insert into entries (event_id, athlete_id)
       select '${event}', id from athletes where slug like 'paste-_-${tag}'`);

  const admin = newPlayer("paste-admin");
  await page.goto("/connexion");
  await signUp(page, admin);
  const adminId = sql(`select id from auth.users where email = '${admin.email}'`);
  sql(`insert into predictions (user_id, event_id, p1, p2, p3)
       values ('${adminId}', '${event}', '${ids[0]}', '${ids[1]}', '${ids[2]}')`);
  sql(`update events set starts_at = now() - interval '1 hour', lock_at = now() - interval '1 hour'
       where id = '${event}'`);
  sql(`update profiles set is_admin = true where id = '${adminId}'`);

  await page.goto(`/admin/${slug}/performances`);
  await page.getByText("Coller les résultats").click();
  const [a, b, c, d] = athletes.map((x) => x.pasted) as [string, string, string, string];
  await page
    .getByLabel("Tableau de résultats")
    .fill(
      [
        "100 Metres Women - Final",
        "Wind: +0.4 m/s",
        "POS\tBIB\tATHLETE\tCOUNTRY\tMARK",
        `1\t4\t${a}\tFRA\t10.92\tPB`,
        `2\t5\t${b}\tFRA\t11.01`,
        `3\t3\t${c}\tFRA\t11.05\tSB`,
        `4\t6\tSomeone ELSE${tag}\tUSA\t11.10`,
        `\t2\t${d}\tFRA\tDNF`,
      ].join("\n"),
    );
  await page.getByRole("button", { name: "Pré-remplir la feuille" }).click();
  await expect(page.getByText("4 athlètes pré-remplis.")).toBeVisible();
  await expect(page.getByText("1 ligne non reconnue :")).toBeVisible();
  await expect(page.getByText(`Someone ELSE${tag} (USA)`)).toBeVisible();

  // The sheet is pre-filled, nothing is saved yet.
  const card = (name: string) => page.getByRole("listitem", { name, exact: true });
  await expect(card(athletes[0]!.name).getByLabel("Place")).toHaveValue("1");
  await expect(card(athletes[0]!.name).getByLabel("Marque")).toHaveValue("10.92");
  await expect(card(athletes[0]!.name).getByLabel("Record personnel")).toBeChecked();
  await expect(card(athletes[3]!.name).getByLabel("Statut")).toHaveValue("dnf");
  expect(sql(`select count(*) from results where event_id = '${event}'`)).toBe("0");

  await page.getByRole("button", { name: "Enregistrer et calculer les points" }).click();
  await page.waitForURL(new RegExp(`/admin/${slug}\\?enregistre=1$`));
  await expect(page.getByText("✓ Points calculés pour 1 joueur.")).toBeVisible();
  expect(
    sql(`select string_agg(r.rank::text, ',' order by r.rank) from results r
         where r.event_id = '${event}'`),
  ).toBe("1,2,3");
  expect(
    sql(`select points_awarded > 0 from predictions where user_id = '${adminId}'
         and event_id = '${event}'`),
  ).toBe("t");

  sql(`delete from competitions where id = '${competition}'`);
  sql(`delete from athletes where slug like 'paste-_-${tag}'`);
});
