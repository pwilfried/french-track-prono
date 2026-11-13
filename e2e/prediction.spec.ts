import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a new player predicts a perfect podium, the admin enters the results sheet and the player gets 12 points", async ({
  page,
}) => {
  // An event still open (run `npm run db:open-events` first).
  const slug = sql(
    `select e.slug from events e join competitions c on c.id = e.competition_id
     where c.slug = 'ultimate-championship-2026' and e.lock_at > now() + interval '5 minutes'
     order by e.starts_at limit 1`,
  );
  expect(slug, "no open event: run npm run db:open-events").not.toBe("");
  const player = newPlayer("prono");
  const email = player.email;

  // Visitor on the event: the sign-in prompt comes back to it.
  await page.goto(`/epreuves/${slug}`);
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(new RegExp(`/epreuves/${slug}$`));

  // No league needed to predict (#375): a league is only suggested under the podium.
  await expect(page.getByRole("heading", { name: "Joue aussi avec tes amis" })).toBeVisible();

  // A first visit shows the tips above the empty podium.
  const tips = page.getByRole("region", { name: "Premier prono : astuces" });
  await expect(tips).toBeVisible();

  // Compose the podium with the first three athletes, then save.
  const athletes = page.locator("li > button[aria-pressed]");
  for (const index of [0, 1, 2]) await athletes.nth(index).click();
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.getByRole("status")).toContainText("Podium enregistré");

  // Reopening the page shows the saved podium, without the tips (#493).
  await page.reload();
  await expect(page.getByRole("button", { name: /^1re place : (?!vide)/ })).toBeVisible();
  await expect(tips).toHaveCount(0);

  // The event locks; saving again is refused.
  sql(`update events set lock_at = now() - interval '1 second' where slug = '${slug}'`);
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Trop tard");

  // The player is made admin (from SQL, as documented) and enters the same podium on the one
  // results sheet of the event: places 1 to 3 only, no click on « Calculer » (#665).
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${email}')`,
  );
  const podium = ["p1", "p2", "p3"].map((step) =>
    sql(`select a.name from predictions p join events e on e.id = p.event_id
         join athletes a on a.id = p.${step}
         join auth.users u on u.id = p.user_id
         where e.slug = '${slug}' and u.email = '${email}'`),
  );
  await page.goto(`/admin/${slug}`);
  await page.getByRole("link", { name: "Saisir la feuille de résultats" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Feuille de résultats");
  for (const [index, name] of podium.entries()) {
    await page
      .getByRole("listitem", { name, exact: true })
      .getByLabel("Place")
      .fill(`${index + 1}`);
  }
  await page.getByRole("button", { name: "Enregistrer et calculer les points" }).click();

  // Back on the event: the points are already computed.
  await page.waitForURL(new RegExp(`/admin/${slug}\\?enregistre=1$`));
  await expect(page.getByText(/✓ Points calculés pour \d+ joueurs?\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Recalculer" })).toBeVisible();

  // The admin log keeps the sheet and the computation, by the player.
  await page.goto("/admin/historique");
  const log = page.getByRole("list", { name: "Actions" }).getByRole("listitem");
  await expect(log.filter({ hasText: "Points calculés" }).first()).toContainText(
    `par ${player.pseudo}`,
  );
  await expect(log.filter({ hasText: "Feuille de résultats saisie" }).first()).toContainText(
    `par ${player.pseudo}`,
  );
  // Back to a player to look at the public pages as they see them.
  sql(
    `update profiles set is_admin = false where id = (select id from auth.users where email = '${player.email}')`,
  );
  await page.goto("/mes-points");
  await expect(page.locator('main:not([aria-busy="true"])')).toContainText("+12 pts");
  await expect(page.locator('main:not([aria-busy="true"])')).toContainText("Podium parfait");

  // The events tab opens on « À faire »; « Terminées » shows it under « Déjà courues » with my
  // result and my points (#488, #546).
  await page.goto("/epreuves?competition=ultimate-championship-2026");
  const filters = page.getByRole("navigation", { name: "Filtrer les épreuves" });
  await expect(filters.getByRole("link", { name: /^À faire/ })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await filters.getByRole("link", { name: /^Terminées/ }).click();
  const done = page.getByRole("region", { name: /^Déjà courues/ });
  await expect(done.locator(`a[href="/epreuves/${slug}"]`)).toContainText("+12 pts");
  await expect(done.locator(`a[href="/epreuves/${slug}"]`)).toContainText("Podium parfait !");

  // The event page now shows the result and my podium against the official one.
  await page.goto(`/epreuves/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("s'impose");
  await expect(page.locator('main:not([aria-busy="true"])')).toContainText("+12 pts");
  await expect(page.getByRole("heading", { name: "Ton prono vs officiel" })).toBeVisible();

  // The perfect podium earns the Nostradamus badge on the profile.
  await page.goto("/profil");
  await expect(page.getByRole("listitem").filter({ hasText: "Nostradamus" })).toHaveAttribute(
    "data-earned",
    "true",
  );
  // The badges grid (#385): locked badges stay listed, and the next one is named.
  await expect(page.getByRole("region", { name: "Badges" })).toContainText("Prochain :");
  // The redesigned profile (#384): the best shot and the season figures.
  await expect(page.getByRole("region", { name: "Mon meilleur coup" })).toContainText(
    "Podium parfait",
  );
  await expect(page.getByRole("region", { name: "Mon meilleur coup" })).toContainText("+12 pts");
  await expect(page.getByRole("region", { name: "Mes stats" })).toContainText("podiums parfaits");
  // The share of computed predictions that gave points says what it counts (#490).
  await expect(page.getByRole("region", { name: "Mes stats" })).toContainText(
    "pronos qui rapportent",
  );
  await expect(page.getByRole("img", { name: /Points cumulés : de 0 à \d+/ })).toBeVisible();

  // My latest predictions (#387): the event with its points, then every prediction of the competition.
  const latest = page.getByRole("region", { name: "Mes derniers pronos" });
  await expect(latest.getByRole("listitem").first()).toContainText("+12 pts");
  await latest.getByRole("link", { name: "Tous mes pronos" }).click();
  await page.waitForURL(/\/profil\/pronos/);
  // Other tests add competitions: open the one of this event.
  await page.goto("/profil/pronos?competition=ultimate-championship-2026");
  const mine = page.locator("main").getByRole("link", { name: /\+12 pts/ });
  await expect(mine).toBeVisible();
  await expect(mine.getByText("bonne place")).toHaveCount(3);
  await mine.click();
  await page.waitForURL(new RegExp(`/epreuves/${slug}$`));
});
