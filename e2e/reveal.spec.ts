import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { joinLeagueFor, newPlayer, signUp } from "./players";

test("a player cannot see a podium before the lock, unfolds it after and reacts to it", async ({
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
  // Bob has a league of his own, without Anna: her podium will be folded (#949).
  joinLeagueFor(bob.email, "ultimate-championship-2026");

  // After the lock, he sees it.
  sql(`update events set lock_at = now() - interval '1 second' where slug = '${slug}'`);
  await bobPage.reload();
  await expect(bobPage.getByRole("heading", { name: "Les pronos" })).toBeVisible();
  // The reveal opens on his league (#984), where Anna is not.
  const filters = bobPage.getByRole("navigation", { name: "Voir les pronos de" });
  const allPlayers = filters.getByRole("link", { name: /^Tous les joueurs/ });
  await expect(filters.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(allPlayers).not.toHaveAttribute("aria-current", "page");
  await expect(bobPage.getByText(anna.pseudo)).toHaveCount(0);
  // On all the players, Anna is in none of his leagues: her podium waits behind
  // « Voir tous les pronos (N) ».
  await allPlayers.click();
  await expect(allPlayers).toHaveAttribute("aria-current", "page");
  await expect(bobPage.getByText(anna.pseudo)).toBeHidden();
  await bobPage.getByText(/^Voir tous les pronos \(\d+\)$/).click();
  await expect(bobPage.getByText(anna.pseudo)).toBeVisible();
  await expect(bobPage.getByText("Masquer les autres pronos")).toBeVisible();
  await expect(
    bobPage.getByRole("heading", { name: "Ce qu'ont pronostiqué les joueurs" }),
  ).toBeVisible();
  await expect(bobPage.getByText(": 100 %").first()).toBeAttached();

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
  const fire = bobPage.getByRole("button", { name: /^Réagir : feu/ });
  await fire.click();
  await expect(fire).toHaveAttribute("aria-pressed", "true");
  await expect(fire).toHaveAccessibleName("Réagir : feu, 1 réaction");
  await annaPage.reload();
  await expect(annaPage.getByText("🔥 1")).toBeVisible();

  // Tapping it again removes it.
  await fire.click();
  await expect(fire).toHaveAttribute("aria-pressed", "false");
});
