import type { Page } from "@playwright/test";

import { MANAGER_SEASON_NAME, managerSeasonCompetitions } from "../src/infra/contract/database";

/**
 * Makes the shared season competitions available (SQL): a Manager league is created on at least
 * 6 of them (#644). Call it before the creation page loads: it lists them.
 */
export function seasonReady(): void {
  managerSeasonCompetitions(10);
}

/**
 * Ticks the first `count` season competitions on the creation page (« Saison Manager 1 » …). The
 * picker opens the first two months only: a search opens them all (#663), then is cleared.
 */
export async function chooseSeason(page: Page, count = 6): Promise<void> {
  const search = page.getByRole("searchbox", { name: "Rechercher une compétition" });
  await search.fill(MANAGER_SEASON_NAME);
  for (let n = 1; n <= count; n += 1) {
    await page
      .getByRole("checkbox", { name: new RegExp(`^${MANAGER_SEASON_NAME} ${n} ·`) })
      .check();
  }
  await search.fill("");
}

/**
 * Submits the creation form and waits for the redirect to the new league. On pre-production the
 * creating action can take more than the 5 s of an assertion (cold function, #869): the wait is
 * bound by the test timeout instead.
 */
export async function createLeague(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Créer la ligue" }).click();
  await page.waitForURL(/\/manager\/[0-9a-f-]{36}$/);
}
