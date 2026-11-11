import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

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
  await page.getByRole("link", { name: "Voir les épreuves" }).click();
  await expect(page).toHaveURL(/\/epreuves\?competition=ultimate-championship-2026$/);
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
  await expect(page).toHaveURL(/\/epreuves\?competition=ultimate-championship-2026$/);
});

test("the app can be installed: the manifest and its icons are served", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();

  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/", scope: "/" });
  for (const icon of manifest.icons as { src: string }[]) {
    const response = await request.get(icon.src);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    /apple-touch-icon\.png/,
  );
});

test("a signed-in player sees the next final on the home page, opens it and predicts", async ({
  page,
}) => {
  // The first final still open of the competition (run `npm run db:open-events` first).
  const slug = sql(
    `select e.slug from events e join competitions c on c.id = e.competition_id
     where c.slug = 'ultimate-championship-2026' and e.round = 'final' and e.lock_at > now()
     order by e.starts_at, e.slug limit 1`,
  );
  expect(slug, "no open final: run npm run db:open-events").not.toBe("");
  const player = newPlayer("home");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);

  await page.goto("/");
  await expect(page.getByText(`Salut ${player.pseudo}`)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Prochaine finale dans");
  // Before a first prediction, the home shows how to play (#476).
  const how = page.getByRole("heading", { name: "Comment ça marche" });
  await expect(how).toBeVisible();
  await expect(page.locator("#how-it-works + ol > li")).toHaveCount(3);

  // Without a league, the card still offers the podium first and suggests a league (#375).
  const next = page.getByRole("region", { name: /./ }).filter({ hasText: "Ton podium est vide" });
  await expect(next.getByRole("link", { name: "Ligue privée", exact: true })).toBeVisible();
  await expect(next.getByRole("link", { name: "Ligue publique", exact: true })).toHaveAttribute(
    "href",
    /\/ligues\/creer\?competition=.+&publique=1$/,
  );
  await next.getByRole("link", { name: "Composer mon podium" }).click();
  await expect(page).toHaveURL(new RegExp(`/epreuves/${slug}$`));

  // After a first prediction, the steps are gone.
  const athletes = page.locator("li > button[aria-pressed]");
  for (const index of [0, 1, 2]) await athletes.nth(index).click();
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.getByRole("status")).toContainText("Podium enregistré");
  await page.goto("/");
  await expect(page.getByText(`Salut ${player.pseudo}`)).toBeVisible();
  await expect(how).toHaveCount(0);
});

test("the header's sign-in link brings a player back to the home page", async ({ page }) => {
  await page.goto("/regles");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Se connecter", exact: true }),
  ).toHaveAttribute("href", "/connexion?next=%2F");
});
