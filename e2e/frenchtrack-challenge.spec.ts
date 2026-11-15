import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("the admin posts FrenchTrack's podium, a player predicts, the result is in and the player sees the verdict", async ({
  browser,
}) => {
  // An open final nobody predicted yet, the last one of the competition: the other tests take
  // the first ones (run `npm run db:open-events` first).
  const slug = sql(
    `select e.slug from events e join competitions c on c.id = e.competition_id
     where c.slug = 'ultimate-championship-2026' and e.round = 'final'
       and e.lock_at > now() + interval '5 minutes'
       and not exists (select 1 from predictions p where p.event_id = e.id)
       and (select count(*) from entries en where en.event_id = e.id) >= 3
     order by e.starts_at desc limit 1`,
  );
  expect(slug, "no open event: run npm run db:open-events").not.toBe("");
  const player = newPlayer("defi");
  const admin = newPlayer("ftadmin");
  const playerPage = await (await browser.newContext()).newPage();
  const adminPage = await (await browser.newContext()).newPage();

  try {
    // The player predicts the first three athletes.
    await playerPage.goto(`/connexion?next=/epreuves/${slug}`);
    await signUp(playerPage, player);
    await playerPage.waitForURL(new RegExp(`/epreuves/${slug}$`));
    const athletes = playerPage.locator("li > button[aria-pressed]");
    for (const index of [0, 1, 2]) await athletes.nth(index).click();
    await playerPage.getByRole("button", { name: "Enregistrer mon podium" }).click();
    await expect(playerPage.getByRole("status")).toContainText("Podium enregistré");
    const [first, second, third] = ["p1", "p2", "p3"].map((step) =>
      sql(`select p.${step} from predictions p join events e on e.id = p.event_id
           join auth.users u on u.id = p.user_id
           where e.slug = '${slug}' and u.email = '${player.email}'`),
    ) as [string, string, string];

    // The admin (the FrenchTrack account) posts FrenchTrack's podium: the same athletes, upside
    // down.
    await adminPage.goto("/connexion");
    await signUp(adminPage, admin);
    sql(
      `update profiles set is_admin = true where id = (select id from auth.users where email = '${admin.email}')`,
    );
    await adminPage.goto(`/admin/${slug}`);
    await adminPage.getByRole("link", { name: "Battez FrenchTrack" }).click();
    await adminPage.getByLabel("1re place").selectOption(third);
    await adminPage.getByLabel("2e place").selectOption(second);
    await adminPage.getByLabel("3e place").selectOption(first);
    await adminPage.getByRole("button", { name: "Enregistrer le prono FrenchTrack" }).click();
    await expect(adminPage).toHaveURL(new RegExp(`/admin/${slug}/frenchtrack\\?enregistre=1$`), {
      timeout: 60_000,
    });
    await expect(adminPage.getByRole("status")).toContainText("Enregistré.");

    // Before the lock, the player knows FrenchTrack posted its podium, not which one.
    await playerPage.reload();
    const card = playerPage.locator("[data-challenge]");
    await expect(card.getByRole("heading", { name: "Battez FrenchTrack" })).toBeVisible();
    await expect(card).toContainText("dévoilé au verrouillage");
    await expect(card.getByRole("region", { name: "Podium de FrenchTrack" })).toHaveCount(0);

    // The event locks; the admin enters the player's podium as the result.
    sql(`update events set lock_at = now() - interval '1 second' where slug = '${slug}'`);
    const names = [first, second, third].map((id) =>
      sql(`select name from athletes where id = '${id}'`),
    );
    await adminPage.goto(`/admin/${slug}`);
    await adminPage.getByRole("link", { name: "Saisir la feuille de résultats" }).click();
    for (const [index, name] of names.entries()) {
      await adminPage
        .getByRole("listitem", { name, exact: true })
        .getByLabel("Place")
        .fill(`${index + 1}`);
    }
    await adminPage.getByRole("button", { name: "Enregistrer et calculer les points" }).click();
    await expect(adminPage).toHaveURL(new RegExp(`/admin/${slug}\\?enregistre=1$`), {
      timeout: 60_000,
    });
    await expect(adminPage.getByText(/✓ Points calculés pour \d+ joueurs?\./)).toBeVisible();

    // The player sees both podiums, the verdict and the share of players who beat FrenchTrack:
    // 12 points against 5 (the 2nd at the right place, two athletes at the wrong one).
    await playerPage.reload();
    await expect(card.locator("[data-verdict]")).toHaveText("Tu as battu FrenchTrack");
    await expect(card.getByRole("region", { name: "Ton podium" })).toContainText("12 pts");
    await expect(card.getByRole("region", { name: "Podium de FrenchTrack" })).toContainText(
      "5 pts",
    );
    await expect(card).toContainText("100 % des joueurs ont battu FrenchTrack");
    await expect(card.getByRole("button", { name: "Partager" })).toBeVisible();

    // The season ranking counts the win.
    await card.getByRole("link", { name: "Qui bat FrenchTrack le plus souvent ?" }).click();
    await expect(playerPage.locator("[data-my-challenge-place]")).toContainText(
      "1 victoire sur 1 défi",
    );
  } finally {
    // The seed event goes back to being no challenge, for the next runs.
    sql(
      `delete from frenchtrack_picks where event_id = (select id from events where slug = '${slug}')`,
    );
  }
});
