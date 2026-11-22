import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a result saved before the lock locks the event: predictions are refused and revealed", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const names = ["Alpha", "Bravo", "Charlie"].map((n) => `${n} Verrou ${tag}`);
  const ids = names.map((name, n) =>
    sql(`insert into athletes (slug, name, country_code, gender)
         values ('early-${n}-${tag}', '${name}', 'FRA', 'F') returning id`),
  );

  // A competition of its own: one 100 m, its predictions open until tomorrow.
  const competition = sql(`insert into competitions (slug, name, starts_on, ends_on)
    values ('early-${tag}', 'Meeting Verrou ${tag}', current_date, current_date + 1) returning id`);
  const slug = `early-100-${tag}`;
  const event =
    sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    values ('${competition}', '${slug}', '100 m', 'F', now() + interval '1 day',
            now() + interval '1 day') returning id`);
  sql(`insert into entries (event_id, athlete_id)
       select '${event}', id from athletes where slug like 'early-_-${tag}'`);

  // A rival predicted while the event was open.
  const rivalPseudo = `Rival Verrou ${tag}`;
  const rivalId = sql(`with u as (
      insert into auth.users (id, email)
      values (gen_random_uuid(), 'e2e-early-rival-${tag}@example.test') returning id
    )
    insert into profiles (id, pseudo, age_confirmed_at)
    select id, '${rivalPseudo}', now() from u returning id`);
  sql(`insert into predictions (user_id, event_id, p1, p2, p3)
       values ('${rivalId}', '${event}', '${ids[0]}', '${ids[1]}', '${ids[2]}')`);

  const admin = newPlayer("early-admin");
  await page.goto("/connexion");
  await signUp(page, admin);
  const adminId = sql(`select id from auth.users where email = '${admin.email}'`);
  sql(`update profiles set is_admin = true where id = '${adminId}'`);

  // The back-office warns before the result is saved, on the event and on the sheet.
  const warning =
    "Cette épreuve n'est pas encore verrouillée : enregistrer le résultat la verrouille maintenant.";
  await page.goto(`/admin/${slug}`);
  await expect(page.getByText(warning)).toBeVisible();
  await page.getByRole("link", { name: "Saisir la feuille de résultats" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Feuille de résultats");
  await expect(page.getByText(warning)).toBeVisible();

  const card = (name: string) => page.getByRole("listitem", { name, exact: true });
  for (const [n, name] of names.entries()) {
    await card(name)
      .getByLabel("Place")
      .fill(`${n + 1}`);
  }
  await page.getByRole("button", { name: "Enregistrer et calculer les points" }).click();
  await page.waitForURL(new RegExp(`/admin/${slug}\\?enregistre=1$`));
  await expect(page.getByText("✓ Points calculés pour 1 joueur.")).toBeVisible();

  // The event is locked now, and the admin log says so.
  expect(sql(`select lock_at <= now() from events where id = '${event}'`)).toBe("t");
  expect(
    sql(`select count(*) from admin_actions
         where action = 'lock_event' and event_id = '${event}' and admin_id = '${adminId}'`),
  ).toBe("1");

  // No prediction is accepted any more.
  expect(() =>
    sql(`insert into predictions (user_id, event_id, p1, p2, p3)
         values ('${adminId}', '${event}', '${ids[0]}', '${ids[1]}', '${ids[2]}')`),
  ).toThrow(/prediction locked/);

  // As a player: the event shows its result with the predictions revealed.
  sql(`update profiles set is_admin = false where id = '${adminId}'`);
  await page.goto(`/epreuves/${slug}`);
  await expect(page.getByRole("button", { name: "Enregistrer mon podium" })).toHaveCount(0);
  await expect(page.getByText("Les pronos des autres se dévoilent au verrouillage.")).toHaveCount(
    0,
  );
  await expect(page.getByRole("heading", { name: "Les pronos" })).toBeVisible();
  // The rival is in none of the player's leagues: their podium may wait behind « Voir tous ».
  const seeAll = page.getByText(/^Voir tous les pronos \(\d+\)$/);
  if (await seeAll.isVisible()) await seeAll.click();
  await expect(page.getByText(rivalPseudo)).toBeVisible();

  sql(`delete from competitions where id = '${competition}'`);
  sql(`delete from athletes where slug like 'early-_-${tag}'`);
  sql(`delete from auth.users where id = '${rivalId}'`);
});
