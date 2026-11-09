import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a player shares the season card: native share on mobile, a download otherwise", async ({
  page,
}) => {
  // Without a session there is no card.
  expect((await page.request.get("/profil/carte")).status()).toBe(401);

  // A competition of its own with one event, and 12 points on it.
  const tag = `e2e-card-${Date.now() % 1000000}`;
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${tag}', 'Test carte ${tag}', current_date + 350, current_date + 351)
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, '${tag}-100m', '100 m', 'F', now() + interval '350 days', now() + interval '350 days'
    from c`);
  const player = newPlayer("card");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);
  sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
    select u.id, e.competition_id, e.id, 'prediction', 12, 'prediction',
           jsonb_build_object('reasons', '[{"kind":"perfect_podium"}]'::jsonb)
    from auth.users u, events e
    where u.email = '${player.email}' and e.slug = '${tag}-100m'`);

  // The card is a story-sized PNG of the signed-in player.
  const card = await page.request.get("/profil/carte");
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toBe("image/png");
  expect((await card.body()).byteLength).toBeGreaterThan(10_000);

  // A device that cannot share files downloads the image.
  await page.reload();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
  });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Partager ma carte de saison" }).click();
  expect((await download).suggestedFilename()).toBe("ma-saison-french-track-prono.png");

  // A phone opens its share sheet with the image.
  await page.evaluate(() => {
    const shared: string[] = [];
    Object.assign(window, { shared });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", {
      value: async (data: { files: File[] }) => {
        shared.push(...data.files.map((f) => `${f.name} ${f.type}`));
      },
      configurable: true,
    });
  });
  await page.getByRole("button", { name: "Partager ma carte de saison" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { shared: string[] }).shared))
    .toEqual(["ma-saison-french-track-prono.png image/png"]);

  sql(`delete from competitions where slug = '${tag}'`);
});
