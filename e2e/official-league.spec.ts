import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a player joins the Ligue FrenchTrack from my leagues and finds it among them", async ({
  page,
}) => {
  // The official league belongs to the admin account (#553): one is made when there is none yet.
  const tag = `${Date.now() % 1000000}`;
  sql(`with u as (
      insert into auth.users (id, email)
      select gen_random_uuid(), 'e2e-official-${tag}@example.test'
      where not exists (select 1 from leagues where is_official)
      returning id
    )
    insert into profiles (id, pseudo, age_confirmed_at, is_admin)
    select id, 'E2E patronne ${tag}', now(), true from u`);
  sql(`select private.create_official_league()`);
  sql(`update leagues set name = 'Ligue FrenchTrack' where is_official`);

  const player = newPlayer("official");
  await page.goto("/ligues");
  await signUp(page, player);
  await page.waitForURL(/\/ligues$/);

  const block = page.getByRole("region", { name: "Ligue FrenchTrack" });
  await expect(block).toContainText("Officielle");
  await expect(block).toContainText("Ouverte à tous");
  await block.getByRole("button", { name: "Rejoindre la Ligue FrenchTrack" }).click();
  await page.waitForURL(/\/ligues\/[0-9a-f-]+$/);

  // Once in, it is one of my leagues, with its badge, and the block is gone.
  await page.goto("/ligues");
  const mine = page.locator("main").getByRole("link", { name: /Ligue FrenchTrack/ });
  await expect(mine).toContainText("Officielle");
  await expect(page.getByRole("region", { name: "Ligue FrenchTrack" })).toHaveCount(0);
});
