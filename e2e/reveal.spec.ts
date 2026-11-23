import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { joinLeagueFor, newPlayer, signUp, skipLeagueSheet } from "./players";

test("a player cannot see a podium before the lock, sees it in a shared league after and reacts to it", async ({
  browser,
}) => {
  // An open event of its own, nobody's prediction on it yet: Anna's is then 100 % of them (#830).
  const slug = sql(
    `select e.slug from events e join competitions c on c.id = e.competition_id
     where c.slug = 'ultimate-championship-2026' and e.lock_at > now() + interval '5 minutes'
       and not exists (select 1 from predictions p where p.event_id = e.id)
     order by e.starts_at offset 3 limit 1`,
  );
  expect(slug, "no open event: run npm run db:open-events").not.toBe("");
  const anna = newPlayer("anna");
  const bob = newPlayer("bob");
  const annaPage = await (await browser.newContext()).newPage();
  const bobPage = await (await browser.newContext()).newPage();

  // Anna predicts.
  await annaPage.goto(`/connexion?next=/epreuves/${slug}`);
  await signUp(annaPage, anna);
  await annaPage.waitForURL(new RegExp(`/epreuves/${slug}$`));
  joinLeagueFor(anna.email, "ultimate-championship-2026");
  await annaPage.reload();
  const athletes = annaPage.locator("li > button[aria-pressed]");
  for (const index of [0, 1, 2]) await athletes.nth(index).click();
  await annaPage.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await skipLeagueSheet(annaPage);
  await expect(annaPage.getByRole("status")).toContainText("Podium enregistré");
  // Before the lock, no consensus: nothing may influence a prediction (#680).
  await expect(
    annaPage.getByRole("heading", { name: "Ce qu'ont pronostiqué les joueurs" }),
  ).toHaveCount(0);

  // Before the lock, Bob sees nothing of Anna's podium.
  await bobPage.goto(`/connexion?next=/epreuves/${slug}`);
  await signUp(bobPage, bob);
  await bobPage.waitForURL(new RegExp(`/epreuves/${slug}$`));
  await expect(
    bobPage.getByText("Les pronos des autres se dévoilent au verrouillage."),
  ).toBeVisible();
  await expect(bobPage.getByText(anna.pseudo)).toHaveCount(0);
  // Bob has a league of his own, without Anna.
  joinLeagueFor(bob.email, "ultimate-championship-2026");

  // Anna adds her podium to her league (#1068), which Bob joins too: there, he sees it.
  sql(`insert into league_predictions (league_id, user_id, event_id)
    select lm.league_id, lm.user_id, e.id
    from league_members lm, auth.users u, events e
    where lm.user_id = u.id and u.email = '${anna.email}' and e.slug = '${slug}'`);
  const annaLeague = sql(`select lm.league_id from league_members lm
    join auth.users u on u.id = lm.user_id where u.email = '${anna.email}' limit 1`);
  sql(`insert into league_members (league_id, user_id, role)
    select '${annaLeague}', id, 'member'::league_role from auth.users where email = '${bob.email}'`);

  // After the lock, he sees it.
  sql(`update events set lock_at = now() - interval '1 second' where slug = '${slug}'`);
  await bobPage.reload();
  await expect(bobPage.getByRole("heading", { name: "Les pronos" })).toBeVisible();
  // The reveal opens on one of his leagues (#984).
  const filters = bobPage.getByRole("navigation", { name: "Voir les pronos de" });
  const allPlayers = filters.getByRole("link", { name: /^Tous les joueurs/ });
  await expect(filters.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(allPlayers).not.toHaveAttribute("aria-current", "page");
  // « Tous » shows only stats, never the list of podiums (#1155).
  await allPlayers.click();
  await expect(allPlayers).toHaveAttribute("aria-current", "page");
  await expect(
    bobPage.getByRole("heading", { name: "Ce qu'ont pronostiqué les joueurs" }),
  ).toBeVisible();
  await expect(bobPage.getByText(": 100 %").first()).toBeAttached();
  await expect(bobPage.getByText(anna.pseudo)).toHaveCount(0);
  await expect(
    bobPage.getByText(/Les pronos un par un se regardent dans tes ligues/),
  ).toBeVisible();
  // In the league he shares with Anna, her podium is there.
  await bobPage.goto(`/epreuves/${slug}?ligue=${annaLeague}`);
  await expect(bobPage.getByText(anna.pseudo)).toBeVisible();

  // Anna sees the consensus with her own choice highlighted at each place.
  await annaPage.reload();
  const consensus = annaPage.getByRole("heading", { name: "Ce qu'ont pronostiqué les joueurs" });
  await expect(consensus).toBeVisible();
  for (const place of ["1er", "2e", "3e"]) {
    const mine = annaPage
      .getByRole("list", { name: `Pronos pour la place de ${place}` })
      .locator('li[aria-current="true"]');
    await expect(mine).toHaveCount(1);
    await expect(mine).toContainText("(ton choix)");
  }

  // Bob reacts with a fire; Anna sees it on her own podium.
  const fire = bobPage
    .getByRole("group", { name: `Réagir au prono de ${anna.pseudo}` })
    .getByRole("button", { name: /^Réagir : feu/ });
  await fire.click();
  await expect(fire).toHaveAttribute("aria-pressed", "true");
  await expect(fire).toHaveAccessibleName("Réagir : feu, 1 réaction");
  await annaPage.reload();
  await expect(annaPage.getByText("🔥 1")).toBeVisible();

  // Tapping it again removes it.
  await fire.click();
  await expect(fire).toHaveAttribute("aria-pressed", "false");
});
