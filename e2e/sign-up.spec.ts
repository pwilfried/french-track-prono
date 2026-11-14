import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { clearMailbox, latestCodeFromMailbox } from "../src/infra/contract/mailbox";
import { newPlayer, signUp } from "./players";

// The only test that sends a real sign-in e-mail (#793): the others sign up with signUp.
test("a visitor taps « Faire mon premier prono », signs up and lands on the first open final", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
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
  const received = await latestCodeFromMailbox(player.email);
  // Enter tries the code: « Autre e-mail », shown first, must not take the default submission.
  await code.fill(received === "000000" ? "111111" : "000000");
  await code.press("Enter");
  await expect(page.getByText("Code incorrect ou expiré.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Regarde tes e-mails");

  // The code copied from the e-mail is pasted, and signs in at once.
  const paste = page.getByRole("button", { name: "Coller le code" });
  await page.evaluate(() => navigator.clipboard.writeText("rien à coller"));
  await paste.click();
  await expect(page.getByRole("status")).toHaveText("Pas de code dans le presse-papiers");
  await expect(code).toBeEditable();
  await page.evaluate((text) => navigator.clipboard.writeText(text), `Ton code : ${received}`);
  await paste.click();
  await page.waitForURL(/\/bienvenue/);

  // The express profile (#539): a pseudo, a bib and the age box, nothing else.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bienvenue !");
  await expect(page.getByText("Choisis comment les autres joueurs te verront.")).toBeVisible();
  await expect(page.getByLabel("Cherche ton club")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Femme" })).toHaveCount(0);
  await expect(
    page.getByText("Ton club et tes disciplines : plus tard, depuis ton profil."),
  ).toBeVisible();
  await page.getByLabel("Ton pseudo").fill(player.pseudo);
  await page.getByLabel("Numéro", { exact: true }).fill("42");
  await page
    .locator("label", { has: page.getByRole("radio", { name: "Rouge", exact: true }) })
    .click();
  await expect(page.getByRole("img", { name: "Dossard 42" })).toBeVisible();
  await page.getByRole("checkbox", { name: /15 ans/ }).check();
  await page.getByRole("button", { name: "C'est parti : mon premier prono" }).click();
  await page.waitForURL(new RegExp(`/epreuves/${slug}$`));

  const profile = `(select id from profiles where pseudo = '${player.pseudo}')`;
  expect(sql(`select bib_number || ' ' || bib_color from profiles where id = ${profile}`)).toBe(
    "42 red",
  );
  expect(sql(`select count(*) from player_details where profile_id = ${profile}`)).toBe("0");
});

test("a new player without an event to go back to lands on the home", async ({ page }) => {
  const player = newPlayer("home");
  await page.goto("/connexion");
  await signUp(page, player);
  await expect(page).toHaveURL(/\/$/);
});

test("sex, disciplines and club are filled in later from « Modifier mon profil »", async ({
  page,
}) => {
  const player = newPlayer("details");
  await page.goto("/profil");
  await page.waitForURL(/\/connexion/);
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);

  await page.goto("/profil/modifier");
  await page.locator("label", { hasText: "Femme" }).click();
  await page.locator("label", { hasText: /^100 m$/ }).click();
  await page.locator("label", { hasText: /^200 m$/ }).click();
  await page.getByLabel("Cherche ton club").fill("fictivil");
  await page.getByRole("button", { name: /Foulées de Fictiville/ }).click();
  await expect(page.getByRole("button", { name: "Changer" })).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/profil\?enregistre=1$/);

  const profile = `(select id from profiles where pseudo = '${player.pseudo}')`;
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
  await page.goto("/profil");
  await page.waitForURL(/\/connexion/);
  // No event behind this sign-in: no reminder.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Connexion ou inscription");
  await expect(page.getByRole("note")).toHaveCount(0);
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);

  // The club is no longer asked at sign-up (#539): it is added from « Modifier mon profil ».
  await page.goto("/profil/modifier");
  await page.getByRole("button", { name: "Mon club n'est pas dans la liste" }).click();
  await page.getByLabel("Nom de ton club").fill("Club Officiel FFA");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("nom de club");

  const club = `Les Foulées ${player.pseudo.slice(-6)}`;
  await page.getByLabel("Nom de ton club").fill(club);
  await page.getByLabel("Ville du club").fill("Nulle-Part");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/profil\?enregistre=1$/);

  expect(
    sql(`select c.validated from profiles p join clubs c on c.id = p.club_id
         where p.pseudo = '${player.pseudo}'`),
  ).toBe("f");
});
