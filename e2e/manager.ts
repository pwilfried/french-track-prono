import { expect, type Page } from "@playwright/test";

import { sql } from "../src/infra/contract/database";

/** The competitions every Manager league of the end-to-end tests is created with (#644). */
export const MANAGER_COMPETITIONS = Array.from(
  { length: 6 },
  (_, i) => `Meeting E2E Manager ${i + 1}`,
);

/**
 * Makes sure the six competitions exist, open to the Manager and not over, a week apart, far
 * after the others (no event: they start on their first day). Then a league of 4 players.
 */
export function ensureManagerCompetitions() {
  for (const [i, name] of MANAGER_COMPETITIONS.entries()) {
    sql(`insert into competitions (slug, name, starts_on, ends_on, status)
         values ('e2e-manager-${i + 1}', '${name}', current_date + ${500 + 7 * i},
                 current_date + ${500 + 7 * i}, 'upcoming')
         on conflict (slug) do update
         set name = excluded.name, starts_on = excluded.starts_on, ends_on = excluded.ends_on,
             status = 'upcoming'`);
  }
  sql(`insert into manager_competitions (competition_id)
       select id from competitions where slug like 'e2e-manager-%'
       on conflict do nothing`);
}

/** The first day of a competition of the tests, "YYYY-MM-DD". */
export const managerCompetitionDay = (n: number) =>
  sql(`select to_char(starts_on, 'YYYY-MM-DD') from competitions where slug = 'e2e-manager-${n}'`);

/**
 * On the creation form: ticks the six competitions, which make a season of 4 players. The form
 * lists the competitions open when it was shown: call ensureManagerCompetitions() before.
 */
export async function pickManagerCompetitions(page: Page) {
  for (const name of MANAGER_COMPETITIONS) {
    await page.getByRole("checkbox", { name: new RegExp(`^${name}(?!\\d)`) }).check();
  }
  await expect(
    page.getByText("6 compétitions → 4 joueurs · 6 journées aller-retour", { exact: true }),
  ).toBeVisible();
}
