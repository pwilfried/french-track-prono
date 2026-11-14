import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { comingCompetition, deleteCompetition } from "./competitions";
import { newPlayer, signUp } from "./players";

test("two friends in the same league see the same ranking", async ({ browser }) => {
  const anna = newPlayer("anna");
  const bob = newPlayer("bob");
  const competition = comingCompetition(`e2e-friends-${Date.now() % 1000000}`);
  const annaPage = await (await browser.newContext()).newPage();
  const bobPage = await (await browser.newContext()).newPage();

  // Anna creates a league and reads its invite code.
  await annaPage.goto("/ligues");
  await signUp(annaPage, anna);
  await annaPage.waitForURL(/\/ligues$/);
  // A league made from a coming competition counts it from the start.
  await annaPage.goto(`/ligues/creer?competition=${competition}`);
  await annaPage.getByLabel("Nom de la ligue").fill("Les Foulées E2E");
  await annaPage.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(annaPage.getByText("Ta ligue est prête")).toBeVisible();
  const leagueUrl = annaPage.url().split("?")[0]!;
  const code = (await annaPage.getByText(/^[A-Z0-9]{3} ?[A-Z0-9]{3}$/).innerText()).replace(
    /\s/g,
    "",
  );
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
      where u.email = '${email}' and e.slug = '${competition}-100m'`);
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
  await expect(rows.nth(0)).toContainText("12");
  await expect(rows.nth(1)).toContainText(bob.pseudo);

  // The rankings tab opens on that league for both, with the same list (#661).
  await annaPage.goto("/classement");
  await bobPage.goto("/classement");
  for (const page of [annaPage, bobPage]) {
    await expect(
      page.getByRole("button", { name: /Changer de classement \(Les Foulées E2E/ }),
    ).toBeVisible();
  }
  const tabByAnna = await annaPage.getByRole("list", { name: "Classement" }).innerText();
  const tabByBob = await bobPage.getByRole("list", { name: "Classement" }).innerText();
  expect(tabByAnna.replace("Toi · ", "")).toBe(tabByBob.replace("Toi · ", ""));
  // « Ta place »: Bob is 9 points behind Anna.
  await expect(bobPage.getByRole("region", { name: "Ta place" })).toContainText(
    `9 pts derrière ${anna.pseudo} (1er)`,
  );

  deleteCompetition(competition);
});

test("a player alone in a league invites a friend, who joins by the link", async ({ browser }) => {
  const owner = newPlayer("alone");
  const friend = newPlayer("bylink");
  const ownerPage = await (await browser.newContext()).newPage();
  const friendPage = await (await browser.newContext()).newPage();
  const competition = comingCompetition(`e2e-alone-${Date.now() % 1000000}`);

  await ownerPage.goto(`/ligues/creer?competition=${competition}`);
  await signUp(ownerPage, owner);
  await ownerPage.waitForURL(/\/ligues\/creer/);
  await ownerPage.getByLabel("Nom de la ligue").fill("Les Seuls E2E");
  await ownerPage.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(ownerPage.getByText("Ta ligue est prête")).toBeVisible();
  const leagueUrl = ownerPage.url().split("?")[0]!;

  // Alone: the banner asks to invite friends, no ranking yet.
  await ownerPage.goto(leagueUrl);
  const banner = ownerPage.getByRole("region", { name: "Tu es seul pour l'instant" });
  await expect(banner.getByRole("button", { name: "Inviter mes amis" })).toBeVisible();
  await expect(ownerPage.getByRole("list", { name: "Classement" })).toHaveCount(0);
  const code = (await banner.getByText(/^Ou donne le code /).innerText())
    .replace("Ou donne le code ", "")
    .replace(/\s/g, "");
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  // The friend opens the link, signs up, joins in one tap and lands in the league.
  await friendPage.goto(`/rejoindre/${code}`);
  await signUp(friendPage, friend);
  await friendPage.waitForURL(new RegExp(`/rejoindre/${code}$`));
  await friendPage.getByRole("button", { name: "Rejoindre la ligue" }).click();
  await friendPage.waitForURL(leagueUrl);
  await expect(friendPage.getByRole("heading", { level: 1 })).toHaveText("Les Seuls E2E");

  // No longer alone: the banner gives way to the ranking.
  await ownerPage.reload();
  await expect(ownerPage.getByRole("button", { name: "Inviter mes amis" })).toHaveCount(0);
  const rows = ownerPage.getByRole("list", { name: "Classement" }).getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(ownerPage.getByText("2 joueurs · créée par toi")).toBeVisible();

  deleteCompetition(competition);
});

test("a player opens their leagues from the bottom bar", async ({ page }) => {
  const player = newPlayer("tab");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);

  const bar = page.getByRole("navigation", { name: "Navigation principale" }).last();
  await bar.getByRole("link", { name: "Ligues" }).click();
  await page.waitForURL(/\/ligues$/);
  await expect(bar.getByRole("link", { name: "Ligues" })).toHaveAttribute("aria-current", "page");
});

test("joining a league that has started is refused (#780)", async ({ browser }) => {
  const owner = newPlayer("started");
  const latecomer = newPlayer("late");
  const ownerPage = await (await browser.newContext()).newPage();
  const latePage = await (await browser.newContext()).newPage();
  const competition = comingCompetition(`e2e-started-${Date.now() % 1000000}`);

  await ownerPage.goto(`/ligues/creer?competition=${competition}`);
  await signUp(ownerPage, owner);
  await ownerPage.waitForURL(/\/ligues\/creer/);
  await ownerPage.getByLabel("Nom de la ligue").fill("Déjà Partis E2E");
  await ownerPage.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(ownerPage.getByText("Ta ligue est prête")).toBeVisible();
  const code = (await ownerPage.getByText(/^[A-Z0-9]{3} ?[A-Z0-9]{3}$/).innerText()).replace(
    /\s/g,
    "",
  );

  // The first event of its competition locks: the league has started.
  sql(`update events set lock_at = now() - interval '1 minute', starts_at = now() - interval '1 minute'
    where slug = '${competition}-100m'`);

  // The invite link says so instead of a « Rejoindre » button.
  await latePage.goto(`/rejoindre/${code}`);
  await signUp(latePage, latecomer);
  await latePage.waitForURL(new RegExp(`/rejoindre/${code}$`));
  await expect(latePage.locator("main").getByRole("alert")).toContainText(
    "Cette ligue a déjà commencé",
  );
  await expect(latePage.getByRole("button", { name: "Rejoindre la ligue" })).toHaveCount(0);
  await expect(latePage.getByRole("link", { name: "Rejoindre une ligue publique" })).toBeVisible();

  // The code typed on « Rejoindre » is refused with the same message.
  await latePage.goto("/ligues/rejoindre");
  await latePage.getByLabel("Code d'invitation").fill(code);
  await latePage.getByRole("button", { name: "Rejoindre la ligue" }).click();
  await expect(latePage.getByText("Cette ligue a déjà commencé")).toBeVisible();
  await expect(latePage).toHaveURL(/\/ligues\/rejoindre$/);

  deleteCompetition(competition);
});
