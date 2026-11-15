import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a new player sees one card on the profile, then the full profile after a first computed event", async ({
  page,
}) => {
  // A competition of its own with one event, scored later for this player only.
  const tag = `e2e-start-${Date.now() % 1000000}`;
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${tag}', 'Test profil ${tag}', current_date + 345, current_date + 346)
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, '${tag}-100m', '100 m', 'F', now() + interval '345 days', now() + interval '345 days'
    from c`);
  const player = newPlayer("start");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);

  // No computed event: the bib, then a single card with the next badge and a way to play (#799).
  const start = page.getByRole("region", {
    name: "Fais ton premier prono pour débloquer tes stats",
  });
  await expect(start).toContainText("Prochain :");
  await expect(
    start.getByRole("link", { name: /Faire mon podium|Voir les compétitions/ }),
  ).toBeVisible();
  for (const name of ["Badges", "Mes stats", "Ma saison", "Mon meilleur coup", "Ma bande"])
    await expect(page.getByRole("region", { name, exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Vitrine", exact: true })).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("pas encore classé");
  await expect(page.locator("main")).not.toContainText(/\b0\spt/);

  // « C'est quoi ? » explains the animal and the badges in a sheet, over the profile (#940).
  await page.getByRole("button", { name: "C'est quoi, l'animal et les badges ?" }).click();
  const help = page.getByRole("dialog", { name: "L'animal et les badges" });
  await expect(help.getByRole("heading", { name: "Les badges", exact: true })).toBeVisible();
  await help.getByRole("button", { name: "Fermer" }).click();
  await expect(help).toBeHidden();

  // A first computed event: the card gives way to the figures and the full grid of badges.
  sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
    select u.id, e.competition_id, e.id, 'prediction', 5, 'prediction',
           jsonb_build_object('reasons', '[]'::jsonb)
    from auth.users u, events e
    where u.email = '${player.email}' and e.slug = '${tag}-100m'`);
  await page.reload();
  await expect(start).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Mes stats" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Badges" }).getByRole("listitem")).not.toHaveCount(
    0,
  );

  sql(`delete from competitions where slug = '${tag}'`);
});
