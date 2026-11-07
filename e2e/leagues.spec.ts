import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("two friends in the same league see the same ranking", async ({ browser }) => {
  const anna = newPlayer("anna");
  const bob = newPlayer("bob");
  const annaPage = await (await browser.newContext()).newPage();
  const bobPage = await (await browser.newContext()).newPage();

  // Anna creates a league and reads its invite code.
  await annaPage.goto("/ligues");
  await signUp(annaPage, anna);
  await annaPage.waitForURL(/\/ligues$/);
  await annaPage.getByRole("link", { name: "Créer une ligue" }).click();
  await annaPage.getByLabel("Nom de la ligue").fill("Les Foulées E2E");
  await annaPage.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(annaPage.getByText("Ta ligue est prête")).toBeVisible();
  const leagueUrl = annaPage.url().split("?")[0]!;
  const code = (await annaPage.locator(".font-mono").innerText()).replace(/\s/g, "");
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  // Bob joins with the code, typed in lower case.
  await bobPage.goto("/ligues/rejoindre");
  await signUp(bobPage, bob);
  await bobPage.waitForURL(/\/ligues\/rejoindre$/);
  await bobPage.getByLabel("Code d'invitation").fill(code.toLowerCase());
  await bobPage.getByRole("button", { name: "Rejoindre la ligue" }).click();
  await bobPage.waitForURL(leagueUrl);

  // Points as the admin would compute them: Anna 12 (perfect podium), Bob 3 (winner found).
  for (const [email, points, reasons] of [
    [anna.email, 12, '[{"kind":"perfect_podium"}]'],
    [bob.email, 3, '[{"kind":"exact","slot":1}]'],
  ] as const) {
    sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
      select u.id, e.competition_id, e.id, 'prediction', ${points}, 'prediction',
             jsonb_build_object('reasons', '${reasons}'::jsonb)
      from auth.users u, events e
      where u.email = '${email}'
        and e.id = (select ev.id from events ev join competitions c on c.id = ev.competition_id
                    where c.slug = 'ultimate-championship-2026' order by ev.starts_at desc limit 1)`);
  }

  // Both see the same ranking: Anna first, Bob second.
  await annaPage.goto(leagueUrl);
  await bobPage.reload();
  const seenByAnna = await annaPage.getByRole("list", { name: "Classement" }).innerText();
  const seenByBob = await bobPage.getByRole("list", { name: "Classement" }).innerText();
  expect(seenByAnna.replace("Toi · ", "")).toBe(seenByBob.replace("Toi · ", ""));
  const rows = annaPage.getByRole("list", { name: "Classement" }).getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(anna.pseudo);
  await expect(rows.nth(1)).toContainText(bob.pseudo);
});
