import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a joker played on another event turns the switch off and says where, and a refused second joker is said once", async ({
  page,
}) => {
  // A competition of its own with two open finals, the same start list (#981).
  const tag = `e2e-${Date.now() % 1000000}`;
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${tag}', 'Test joker ${tag}', current_date + 5, current_date + 6) returning id
    ), e as (
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select id, '${tag}-' || d.slug, d.name, 'F', now() + d.days, now() + d.days
      from c, (values ('100m', '100 m', interval '5 days'),
                      ('200m', '200 m', interval '6 days')) as d(slug, name, days)
      returning id
    )
    insert into entries (event_id, athlete_id)
    select e.id, a.id from e, (select id from athletes where gender = 'F' order by name limit 4) a`);
  const first = `/epreuves/${tag}-100m`;
  const second = `/epreuves/${tag}-200m`;
  const player = newPlayer("joker");

  await page.goto(second);
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(new RegExp(`${second}$`));

  // A podium saved on the 200 m.
  const athletes = page.locator("li > button[aria-pressed]");
  for (const index of [0, 1, 2]) await athletes.nth(index).click();
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.getByRole("button", { name: "✓ Podium enregistré" })).toBeVisible();

  // The joker is played on the 100 m, in another tab: this page does not know it yet.
  const other = await page.context().newPage();
  await other.goto(first);
  const otherAthletes = other.locator("li > button[aria-pressed]");
  for (const index of [0, 1, 2]) await otherAthletes.nth(index).click();
  const otherJoker = other.getByRole("switch", { name: /Joker/ });
  await other.locator("label").filter({ has: otherJoker }).click();
  await other.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(other.getByRole("button", { name: "✓ Podium enregistré" })).toBeVisible();
  await other.close();

  // Back on the 200 m: the second joker is refused, said once, and the save is no longer shown.
  const joker = page.getByRole("switch", { name: /Joker/ });
  await page.locator("label").filter({ has: joker }).click();
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  const refused = "Tu as déjà utilisé ton joker dans cette compétition.";
  await expect(page.locator("main").getByRole("alert")).toHaveText(refused);
  await expect(page.getByRole("alert").filter({ hasText: refused })).toHaveCount(1);
  await expect(page.getByText("Tu peux le modifier jusqu'au verrouillage.")).toHaveCount(0);

  // Opened again, the switch is off and says where the joker is, still movable from there.
  await page.reload();
  await expect(joker).toBeDisabled();
  await expect(joker).not.toBeChecked();
  await expect(page.getByText("Joker joué sur")).toBeVisible();
  await expect(page.getByText("retire-le d'abord de là-bas")).toBeVisible();
  const link = page.getByText("Joker joué sur").getByRole("link");
  await expect(link).toContainText("100 m");
  await expect(link).toHaveAttribute("href", first);

  // Once the 100 m is locked, the joker stays there.
  sql(`update events set lock_at = now() - interval '1 second' where slug = '${tag}-100m'`);
  await page.reload();
  await expect(joker).toBeDisabled();
  await expect(page.getByText("Cette épreuve est verrouillée : il y reste.")).toBeVisible();

  await link.click();
  await page.waitForURL(new RegExp(`${first}$`));

  sql(`delete from competitions where slug = '${tag}'`);
});
