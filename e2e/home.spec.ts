import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { defaultCompetitionSlug } from "./competitions";
import { joinLeagueFor, newPlayer, signUp } from "./players";

test("a visitor sees one main action above the fold, how to play and the next competition", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Devine le podium. Bats tes amis.",
  );
  const play = page.getByRole("link", { name: "Faire mon premier prono" });
  await expect(play).toBeInViewport();
  const box = (await play.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(play).toHaveAttribute("href", /^\/connexion\?next=%2Fepreuves%2F.+$/);
  await expect(page.getByRole("navigation", { name: "Types de compétition" })).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Comment ça marche" })).toBeVisible();
  await expect(page.locator("main ol > li")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Créer une ligue" })).toBeVisible();
  // No podcast block for a visitor: the footer keeps FrenchTrack's accounts (#711).
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Instagram (nouvel onglet)" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Voir les épreuves" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/competitions\\?competition=${defaultCompetitionSlug()}$`),
  );
});

test("a visitor sees a competition, its next events and reaches the full list", async ({
  page,
}) => {
  await page.goto("/competitions/ultimate-championship-2026");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prochaines épreuves" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navigation principale" }).first(),
  ).toBeAttached();

  await page.getByRole("link", { name: /^Voir les \d+ épreuves$/ }).click();
  await expect(page).toHaveURL(/\/competitions\?competition=ultimate-championship-2026$/);
});

test("the app can be installed: the manifest and its icons are served", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();

  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({
    display: "standalone",
    start_url: "/",
    scope: "/",
    short_name: "FrenchTrack",
  });
  for (const icon of manifest.icons as { src: string }[]) {
    const response = await request.get(icon.src);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    /apple-touch-icon\.png/,
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
    "content",
    "FrenchTrack",
  );
  await expect(page.locator('link[rel="icon"][sizes="32x32"]')).toHaveAttribute(
    "href",
    /favicon-32\.png/,
  );
  expect((await request.get("/favicon.ico")).ok()).toBe(true);
});

/**
 * The open final of a competition closest to its lock (run `npm run db:open-events` first). With
 * `margin`, one that stays open long enough to predict it: on pre-production the finals lock on
 * the real clock, and one may lock during the test (#953).
 */
function closestFinal(competition: string, margin = "0 seconds") {
  const slug = sql(
    `select e.slug from events e join competitions c on c.id = e.competition_id
     where c.slug = '${competition}' and e.round = 'final'
       and e.lock_at > now() + interval '${margin}'
     order by e.lock_at, e.starts_at, e.slug limit 1`,
  );
  expect(slug, "no open final: run npm run db:open-events").not.toBe("");
  return slug;
}

test("a new player without a league is asked for a first podium, then for a league", async ({
  page,
}) => {
  const slug = closestFinal(defaultCompetitionSlug());
  const player = newPlayer("home");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Bienvenue, ${player.pseudo}`);
  // One action first, the closest to its lock (#526).
  const action = page.getByRole("region", { name: "Ta prochaine action" });
  await expect(action).toContainText("Ton premier prono");
  await expect(action).toContainText(/Verrouille dans/);
  await expect(action).toContainText(/heure de Paris/);
  const play = action.getByRole("link", { name: "Faire mon podium" });
  await expect(play).toHaveAttribute("href", `/epreuves/${slug}`);
  await expect(play).toBeInViewport();
  // The next action is the first block (#932).
  const blocks = await page
    .locator("main section[aria-labelledby]")
    .evaluateAll((sections) => sections.map((s) => s.getAttribute("aria-labelledby")));
  expect(blocks[0]).toBe("next-action-label");

  // Before a first prediction, the three steps on one line (#476), closed with ×.
  const steps = page.getByRole("region", { name: "Comment ça marche" });
  await expect(steps.locator("ol > li")).toHaveCount(3);

  // Without a league, the friends' game; the Manager; FrenchTrack.
  const league = page.getByRole("region", { name: "C'est entre amis que ça se joue" });
  await expect(league.getByRole("link", { name: "Créer ma ligue" })).toHaveAttribute(
    "href",
    "/ligues/creer",
  );
  await expect(league.getByRole("link", { name: "Ou rejoindre une ligue publique" })).toBeVisible();
  const manager = page.getByRole("region", { name: "French Track Manager" });
  await expect(manager.getByRole("link", { name: "Ouvrir le Manager" })).toHaveAttribute(
    "href",
    "/manager",
  );
  // One « Écouter » link: the latest episode published, else the podcast (pre-production may
  // have a real episode, #953).
  const frenchTrack = page.getByRole("region", { name: "Le podcast FrenchTrack" });
  await expect(
    frenchTrack.getByRole("link", {
      name: /^Écouter (le dernier épisode|l'épisode) \(nouvel onglet\)$/,
    }),
  ).toHaveCount(1);
  for (const name of ["Instagram", "YouTube", "TikTok"]) {
    await expect(frenchTrack.getByRole("link", { name: `${name} (nouvel onglet)` })).toBeVisible();
  }
  // The accounts appear once (#711): the footer leaves them out, keeps the legal links.
  const footer = page.getByRole("contentinfo");
  for (const name of ["Instagram", "YouTube", "TikTok", "Le podcast"]) {
    await expect(footer.getByRole("link", { name: `${name} (nouvel onglet)` })).toBeHidden();
  }
  await expect(footer.getByRole("link", { name: "Mentions légales" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Confidentialité" })).toBeVisible();

  // The old blocks are gone, and no block is left empty.
  const main = page.locator("main");
  await expect(main).not.toContainText("Aucune");
  await expect(main).not.toContainText("Choisis ta compétition");
  await expect(main).not.toContainText("Prochaines compétitions");
  await expect(page.getByRole("region", { name: "Dernier résultat" })).toHaveCount(0);

  await steps.getByRole("button", { name: "Masquer « Comment ça marche »" }).click();
  await expect(steps).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Comment ça marche" })).toHaveCount(0);

  await play.click();
  await expect(page).toHaveURL(new RegExp(`/epreuves/${slug}$`));
});

test("a player in a league sees their place in it and their next final after a prediction", async ({
  page,
}) => {
  const slug = closestFinal("ultimate-championship-2026", "3 minutes");
  const player = newPlayer("home-league");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);
  joinLeagueFor(player.email, "ultimate-championship-2026");

  await page.goto(`/epreuves/${slug}`);
  const athletes = page.locator("li > button[aria-pressed]");
  for (const index of [0, 1, 2]) await athletes.nth(index).click();
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.getByRole("status")).toContainText("Podium enregistré");

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Salut ${player.pseudo}`);
  await expect(page.getByRole("region", { name: "Comment ça marche" })).toHaveCount(0);
  // The final just predicted is no longer the next action.
  const action = page.getByRole("region", { name: "Ta prochaine action" });
  await expect(action).toContainText(/À toi de jouer|Prochaine compétition/);
  await expect(action.locator(`a[href="/epreuves/${slug}"]`)).toHaveCount(0);

  const league = page.getByRole("region", { name: "Ma ligue" });
  await expect(league).toContainText("Ligue E2E");
  await expect(league).toContainText("1er sur 1");
  await expect(league).toContainText("Tu es en tête");
  await expect(league.locator('li[aria-current="true"]')).toContainText(player.pseudo);
  await expect(league.getByRole("link", { name: "Classement" })).toHaveAttribute(
    "href",
    /^\/ligues\/.+$/,
  );
  await expect(page.locator("main")).not.toContainText("Aucune");
});

test("the header's sign-in link brings a player back to the home page", async ({ page }) => {
  await page.goto("/regles");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Se connecter", exact: true }),
  ).toHaveAttribute("href", "/connexion?next=%2F");
});
