import type { Page } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { clearMailbox, latestCodeFromMailbox } from "../src/infra/contract/mailbox";

/** A new invented player: e-mail on example.test, short pseudo. */
export function newPlayer(tag: string) {
  const id = `${Date.now() % 1000000}${Math.floor(Math.random() * 100)}`;
  return { email: `e2e-${tag}-${id}@example.test`, pseudo: `E2E ${tag} ${id}`.slice(0, 24) };
}

/**
 * Signs a new player up from the sign-in page (already open, e.g. after a redirect): e-mail code
 * read in the local mailbox (or from the admin API in pre-production), then the profile. Ends on
 * the page the sign-in was asked from.
 */
export async function signUp(page: Page, player: { email: string; pseudo: string }) {
  await page.getByLabel("Ton e-mail").fill(player.email);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await typeCode(page, player.email);
  await page.getByRole("button", { name: "Me connecter" }).click();
  await page.waitForURL(/\/bienvenue/);
  await page.getByLabel("Ton pseudo").fill(player.pseudo);
  // The bib drawn at random by the welcome page is kept as is.
  await page.getByRole("checkbox", { name: /15 ans/ }).check();
  await page.getByRole("button", { name: "C'est parti : mon premier prono" }).click();
  // The profile exists once the welcome page is left: tests may then change it in SQL.
  await page.waitForURL((url) => !url.pathname.startsWith("/bienvenue"));
}

/** Signs an existing player in again from the sign-in page (already open), with a fresh code. */
export async function signIn(page: Page, email: string) {
  await clearMailbox(email);
  await page.getByLabel("Ton e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await typeCode(page, email);
  await page.getByRole("button", { name: "Me connecter" }).click();
}

/**
 * Types the code sent to an address, read once the code field is shown: the app has sent it by
 * then (against pre-production, the code asked from the admin API must come after that one).
 * A refused sending (e.g. AUTH_UNAVAILABLE once the hourly e-mail cap is hit, #810) fails the test
 * at once with the message shown, instead of waiting the whole test timeout for the field.
 */
export async function typeCode(page: Page, email: string) {
  const field = page.getByLabel(/code/i);
  const refusal = page.getByRole("main").getByRole("alert").first();
  await field.or(refusal).first().waitFor();
  if (await refusal.isVisible()) {
    throw new Error(`No sign-in code sent to ${email}: « ${await refusal.innerText()} »`);
  }
  await field.fill(await latestCodeFromMailbox(email));
}

/**
 * Adds an invented friend, without points, to a league (SQL): a league shows its ranking once its
 * creator is no longer alone (#552). Returns the friend's e-mail, to delete them afterwards.
 */
export function addFriendTo(leagueUrl: string, tag: string) {
  const leagueId = leagueUrl.split("/").pop()!;
  const email = `e2e-friend-${tag}@example.test`;
  sql(`with u as (
      insert into auth.users (id, email) values (gen_random_uuid(), '${email}') returning id
    ), p as (
      insert into profiles (id, pseudo, age_confirmed_at)
      select id, 'Ami ${tag}'::text, now() from u returning id
    )
    insert into league_members (league_id, user_id) select '${leagueId}', id from p`);
  return email;
}

/**
 * Puts a player in a league of his own counting the competition (SQL, for the tests that are not
 * about leagues): a player predicts only from such a league (#311).
 */
export function joinLeagueFor(email: string, competitionSlug: string) {
  sql(`with u as (select id from auth.users where email = '${email}'),
    l as (insert into leagues (name, owner_id) select 'Ligue E2E', id from u returning id, owner_id),
    m as (insert into league_members (league_id, user_id, role) select id, owner_id, 'owner' from l)
    insert into league_competitions (league_id, competition_id)
    select l.id, c.id from l, competitions c where c.slug = '${competitionSlug}'`);
}
