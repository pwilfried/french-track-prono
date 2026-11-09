import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a visitor chooses between the two kinds of competitions", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Choisis ta compétition");
  const kinds = page.getByRole("navigation", { name: "Types de compétition" });
  await expect(kinds.getByRole("link")).toHaveCount(2);
  await kinds.getByRole("link", { name: /Compétitions internationales/ }).click();
  await expect(page).toHaveURL(/\/competitions\?type=international$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Compétitions internationales");
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

test("a signed-in player sees the next final on the home page and opens it", async ({ page }) => {
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
  const next = page.getByRole("region", { name: /./ }).filter({ hasText: "Ton podium est vide" });
  await expect(next).toBeVisible();
  await next.getByRole("link", { name: "Composer mon podium" }).click();
  await expect(page).toHaveURL(new RegExp(`/epreuves/${slug}$`));
});
