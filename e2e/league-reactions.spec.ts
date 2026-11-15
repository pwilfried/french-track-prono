import { expect, test, type Page } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

/** A league with the player and a friend, and one moment about the friend (#672). */
async function leagueWithMoment(page: Page, tag: string) {
  const player = newPlayer("react");
  await page.goto("/connexion");
  await signUp(page, player);
  const playerId = sql(`select id from auth.users where email = '${player.email}'`);
  const friendId = sql(`with u as (
      insert into auth.users (id, email)
      values (gen_random_uuid(), 'e2e-react-friend-${tag}@example.test') returning id
    )
    insert into profiles (id, pseudo, age_confirmed_at)
    select id, 'Ami Réac ${tag}', now() from u returning id`);
  const league = sql(`with l as (
      insert into leagues (name, owner_id) values ('Ligue Réac ${tag}', '${playerId}') returning id
    ), m as (
      insert into league_members (league_id, user_id, role)
      select id, '${playerId}'::uuid, 'owner'::league_role from l
      union all
      select id, '${friendId}'::uuid, 'member'::league_role from l
    ), moment as (
      insert into league_moments (league_id, key, kind, user_id)
      select id, 'new_leader:e2e-${tag}:${friendId}', 'new_leader', '${friendId}' from l
    )
    select id from l`);
  const cleanUp = () => {
    sql(`delete from leagues where id = '${league}'`);
    sql(`delete from auth.users where id = '${friendId}'`);
  };
  return {
    player,
    playerId,
    friendId,
    league,
    momentKey: `new_leader:e2e-${tag}:${friendId}`,
    cleanUp,
  };
}

test("a member reacts to a moment, sees the count, and sends « Bien joué ! » under it", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const { player, league, cleanUp } = await leagueWithMoment(page, tag);

  await page.goto(`/ligues/${league}?onglet=fil`);
  const moment = page.getByRole("article").filter({ hasText: "Nouveau leader" });
  await expect(moment).toContainText(`Ami Réac ${tag} prend la tête de la ligue.`);

  // 🔥: the counter shows 1, mine; tapping it again removes it.
  await moment.getByRole("button", { name: "Réagir : feu" }).click();
  const mine = moment.getByRole("button", { name: "Retirer ma réaction feu (1)" });
  await expect(mine).toHaveAttribute("aria-pressed", "true");
  await expect(mine).toContainText("1");
  await mine.click();
  await expect(moment.getByRole("button", { name: "Réagir : feu" })).toBeVisible();

  // « Message » opens the preset messages; « Bien joué ! » shows under the moment with my pseudo.
  await moment.getByRole("button", { name: "Envoyer un message sous ce moment" }).click();
  await page
    .getByRole("dialog", { name: "Envoyer un message" })
    .getByRole("button", { name: "Bien joué !" })
    .click();
  await expect(moment.getByRole("status")).toContainText("Message envoyé.");
  await expect(moment.getByRole("list", { name: "Messages" })).toContainText(
    `${player.pseudo} · Bien joué !`,
  );

  cleanUp();
});

test("a member reports a message, the admin hides it, it disappears from the feed", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const { playerId, friendId, league, momentKey, cleanUp } = await leagueWithMoment(page, tag);
  // The friend wrote « Revanche ? » under the moment.
  sql(`insert into moment_reactions (league_id, moment_key, user_id, kind, code)
       values ('${league}', '${momentKey}', '${friendId}', 'message', 'rematch')`);

  await page.goto(`/ligues/${league}?onglet=fil`);
  const messages = page.getByRole("list", { name: "Messages" });
  await expect(messages).toContainText(`Ami Réac ${tag} · Revanche ?`);
  await messages.getByRole("button", { name: `Signaler le message de Ami Réac ${tag}` }).click();
  await expect(messages).toContainText("Signalé");

  // The admin sees it in « Signalements du fil » and hides it.
  sql(`update profiles set is_admin = true where id = '${playerId}'`);
  await page.goto("/admin/ligues");
  const reports = page.getByRole("list", { name: "Signalements du fil" });
  await expect(reports).toContainText(`« Revanche ? » de Ami Réac ${tag}`);
  await reports.getByRole("button", { name: `Masquer « Revanche ? » de Ami Réac ${tag}` }).click();
  await expect(page.getByRole("status").filter({ hasText: "Masqué pour tous." })).toBeVisible();
  sql(`update profiles set is_admin = false where id = '${playerId}'`);

  // Gone from the feed.
  await page.goto(`/ligues/${league}?onglet=fil`);
  await expect(page.getByRole("article").filter({ hasText: "Nouveau leader" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Messages" })).toHaveCount(0);

  cleanUp();
});
