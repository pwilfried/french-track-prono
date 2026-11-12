import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { clearMailbox, latestCodeFromMailbox } from "../src/infra/contract/mailbox";
import { newPlayer } from "./players";

test("a visitor taps « Faire mon premier prono », signs up and lands on the first open final", async ({
  page,
}) => {
  // The first final still open of the competition (run `npm run db:open-events` first).
  const slug = sql(
    `select e.slug from events e join competitions c on c.id = e.competition_id
     where c.slug = 'ultimate-championship-2026' and e.round = 'final' and e.lock_at > now()
     order by e.starts_at, e.slug limit 1`,
  );
  expect(slug, "no open final: run npm run db:open-events").not.toBe("");
  const player = newPlayer("signup");
  await clearMailbox(player.email);
  await page.goto("/");
  await page.getByRole("link", { name: "Faire mon premier prono" }).click();
  await page.waitForURL(/\/connexion/);
  // The page says it signs up too, and keeps the event in view, named from the database.
  const [discipline, gender] = sql(
    `select discipline || '|' || gender from events where slug = '${slug}'`,
  ).split("|");
  const genderName = { F: "femmes", M: "hommes", X: "mixte" }[gender];
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Connexion ou inscription");
  await expect(page.getByRole("note")).toHaveText(
    `Ton podium du ${discipline} ${genderName} t'attend. Encore une minute et tu le poses.`,
  );
  await page.getByLabel("Ton e-mail").fill(player.email);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Regarde tes e-mails");
  await expect(page.getByText(player.email)).toBeVisible();
  const code = page.getByLabel(/code/i);
  await expect(code).toHaveAttribute("inputmode", "numeric");
  await expect(code).toHaveAttribute("autocomplete", "one-time-code");
  await code.fill(await latestCodeFromMailbox(player.email));
  // Enter signs in: « Autre e-mail », shown first, must not take the default submission.
  await code.press("Enter");
  await page.waitForURL(/\/bienvenue/);

  await page.getByLabel("Ton pseudo").fill(player.pseudo);
  await page.getByLabel("Numéro", { exact: true }).fill("42");
  await page
    .locator("label", { has: page.getByRole("radio", { name: "Rouge", exact: true }) })
    .click();
  await expect(page.getByRole("img", { name: "Dossard 42" })).toBeVisible();
  await page.locator("label", { hasText: "Femme" }).click();
  await page.locator("label", { hasText: /^100 m$/ }).click();
  await page.locator("label", { hasText: /^200 m$/ }).click();
  await page.getByLabel("Cherche ton club").fill("fictivil");
  await page.getByRole("button", { name: /Foulées de Fictiville/ }).click();
  await expect(page.getByRole("button", { name: "Changer" })).toBeVisible();
  await page.getByRole("checkbox", { name: /15 ans/ }).check();
  await page.getByRole("button", { name: "Créer mon profil" }).click();
  await page.waitForURL(new RegExp(`/epreuves/${slug}$`));

  const profile = `(select id from profiles where pseudo = '${player.pseudo}')`;
  expect(sql(`select bib_number || ' ' || bib_color from profiles where id = ${profile}`)).toBe(
    "42 red",
  );
  expect(sql(`select sex from player_details where profile_id = ${profile}`)).toBe("F");
  expect(
    sql(`select array_to_string(array(select unnest(disciplines) order by 1), ',')
         from player_details where profile_id = ${profile}`),
  ).toBe("100 m,200 m");
  expect(
    sql(`select c.name from profiles p join clubs c on c.id = p.club_id where p.id = ${profile}`),
  ).toBe("Foulées de Fictiville");
});

test("a club missing from the list is typed and waits for validation", async ({ page }) => {
  const player = newPlayer("club");
  await clearMailbox(player.email);
  await page.goto("/profil");
  await page.waitForURL(/\/connexion/);
  // No event behind this sign-in: no reminder.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Connexion ou inscription");
  await expect(page.getByRole("note")).toHaveCount(0);
  await page.getByLabel("Ton e-mail").fill(player.email);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await page.getByLabel(/code/i).fill(await latestCodeFromMailbox(player.email));
  await page.getByRole("button", { name: "Me connecter" }).click();
  await page.waitForURL(/\/bienvenue/);

  await page.getByLabel("Ton pseudo").fill(player.pseudo);
  await page.getByRole("button", { name: "Mon club n'est pas dans la liste" }).click();
  await page.getByLabel("Nom de ton club").fill("Club Officiel FFA");
  await page.getByRole("checkbox", { name: /15 ans/ }).check();
  await page.getByRole("button", { name: "Créer mon profil" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("nom de club");

  const club = `Les Foulées ${player.pseudo.slice(-6)}`;
  await page.getByLabel("Nom de ton club").fill(club);
  await page.getByLabel("Ville du club").fill("Nulle-Part");
  await page.getByRole("button", { name: "Créer mon profil" }).click();
  await page.waitForURL(/\/profil$/);

  expect(
    sql(`select c.validated from profiles p join clubs c on c.id = p.club_id
         where p.pseudo = '${player.pseudo}'`),
  ).toBe("f");
});

test("a visitor pastes the code copied from the e-mail and is signed in", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const player = newPlayer("paste");
  await clearMailbox(player.email);
  await page.goto("/connexion");
  await page.getByLabel("Ton e-mail").fill(player.email);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  const paste = page.getByRole("button", { name: "Coller le code" });

  // Nothing to paste yet: a short message, the field stays usable.
  await page.evaluate(() => navigator.clipboard.writeText("rien à coller"));
  await paste.click();
  await expect(page.getByRole("status")).toHaveText("Pas de code dans le presse-papiers");
  await expect(page.getByLabel(/code/i)).toBeEditable();

  const code = await latestCodeFromMailbox(player.email);
  await page.evaluate((text) => navigator.clipboard.writeText(text), `Ton code : ${code}`);
  await paste.click();
  await page.waitForURL(/\/bienvenue/);
});
