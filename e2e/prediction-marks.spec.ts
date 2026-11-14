import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { joinLeagueFor, newPlayer, signUp } from "./players";

/** The first open final of the Ultimate Championship whose discipline matches. */
function openFinal(where: string) {
  return sql(
    `select e.slug from events e join competitions c on c.id = e.competition_id
     join disciplines d on d.name = e.discipline
     where c.slug = 'ultimate-championship-2026' and ${where} and e.round = 'final'
       and e.lock_at > now() + interval '5 minutes'
     order by e.starts_at limit 1`,
  );
}

test("a player predicts a podium with a mark for each of his three athletes", async ({ page }) => {
  // An open sprint (run `npm run db:open-events` first): marks are times of under 90 s.
  const slug = openFinal(`d.family in ('sprint', 'hurdles')`);
  expect(slug, "no open race: run npm run db:open-events").not.toBe("");
  const player = newPlayer("perf");

  await page.goto(`/epreuves/${slug}`);
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(new RegExp(`/epreuves/${slug}$`));
  joinLeagueFor(player.email, "ultimate-championship-2026");
  await page.reload();

  const athletes = page.locator("li > button[aria-pressed]");
  for (const index of [0, 1, 2]) await athletes.nth(index).click();
  const marks = page.getByRole("group", { name: "Tes perfs (facultatif)" }).getByRole("textbox");
  await expect(marks).toHaveCount(3);

  // A mark that is not a time is refused.
  await marks.nth(0).fill("vite");
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("ne correspond pas");

  for (const [index, mark] of ["49.10", "49,35", "49.80"].entries()) {
    await marks.nth(index).fill(mark);
  }
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.getByRole("status")).toContainText("Podium enregistré");

  await page.reload();
  await expect(marks.nth(1)).toHaveValue("49.35");
  expect(
    sql(`select m1 || ' ' || m2 || ' ' || m3 from predictions p join auth.users u on u.id = p.user_id
         where u.email = '${player.email}'`),
  ).toBe("49.10 49.35 49.80");
});

test("a 300-digit triple jump mark is refused next to its field, a plausible one saves", async ({
  page,
}) => {
  const slug = openFinal(`d.name = 'Triple saut'`);
  expect(slug, "no open triple jump: run npm run db:open-events").not.toBe("");
  const player = newPlayer("jump");

  await page.goto(`/epreuves/${slug}`);
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(new RegExp(`/epreuves/${slug}$`));
  joinLeagueFor(player.email, "ultimate-championship-2026");
  await page.reload();

  const athletes = page.locator("li > button[aria-pressed]");
  for (const index of [0, 1, 2]) await athletes.nth(index).click();
  const marks = page.getByRole("group", { name: "Tes perfs (facultatif)" }).getByRole("textbox");
  const first = marks.nth(0);
  await expect(first).toHaveAttribute("inputmode", "decimal");

  // The field takes only a bounded number of characters, and an absurd mark is refused.
  await first.fill(`8${"0".repeat(297)}989`);
  expect((await first.inputValue()).length).toBeLessThanOrEqual(12);
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Entre 5,00 m et 20,00 m pour le triple saut",
  );
  await expect(page.getByText("Podium enregistré")).toHaveCount(0);
  // The podium is still there.
  await expect(page.locator('li > button[aria-pressed="true"]')).toHaveCount(3);
  expect(
    sql(`select count(*) from predictions p join auth.users u on u.id = p.user_id
         where u.email = '${player.email}'`),
  ).toBe("0");

  await first.fill("14,85");
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.getByRole("status")).toContainText("Podium enregistré");
  expect(
    sql(`select m1 from predictions p join auth.users u on u.id = p.user_id
         where u.email = '${player.email}'`),
  ).toBe("14.85");
});
