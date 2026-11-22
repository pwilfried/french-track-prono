import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { joinLeagueFor, newPlayer, signUp } from "./players";

/** A day of the calendar, `days` after today (UTC), as YYYY-MM-DD. */
const dayFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** How the league writes the day of a final (Paris time). */
const shortDay = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));

test("a competition moved in the back-office moves its events in the league (#1070)", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const slug = `e2e-dates-${tag}`;
  const startsOn = dayFromNow(300);
  const movedTo = dayFromNow(307);
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${slug}', 'Meeting E2E ${tag}', '${startsOn}', '${startsOn}')
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, '${slug}-100m', '100 m', 'F', '${startsOn}T16:35:00Z', '${startsOn}T16:30:00Z'
    from c`);
  const player = newPlayer("dates");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);
  joinLeagueFor(player.email, slug);
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );
  const leagueId = sql(`select l.id from leagues l
    join league_competitions lc on lc.league_id = l.id
    join competitions c on c.id = lc.competition_id
    where c.slug = '${slug}'`);

  await page.goto(`/ligues/${leagueId}`);
  const block = page.getByRole("region", { name: "Pronostiquer dans cette ligue" });
  await expect(block).toContainText(shortDay(`${startsOn}T16:35:00Z`));

  // The admin moves the competition a week later; its events follow (ticked by default).
  await page.goto(`/admin/competitions/${slug}/modifier`);
  await expect(page.getByLabel("Décaler aussi les épreuves")).toBeChecked();
  await page.getByLabel("Début", { exact: true }).fill(movedTo);
  await page.getByLabel("Fin", { exact: true }).fill(movedTo);
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/competitions/${slug}\\?enregistre=1$`));

  await page.goto(`/ligues/${leagueId}`);
  await expect(block).toContainText(shortDay(`${movedTo}T16:35:00Z`));

  sql(`delete from competitions where slug = '${slug}'`);
});
