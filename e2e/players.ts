import type { Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { sql } from "../src/infra/contract/database";

/** A new invented player: e-mail on example.test, short pseudo. */
export function newPlayer(tag: string) {
  const id = `${Date.now() % 1000000}${Math.floor(Math.random() * 100)}`;
  return { email: `e2e-${tag}-${id}@example.test`, pseudo: `E2E ${tag} ${id}`.slice(0, 24) };
}

/**
 * Signs a new player up from the sign-in page (already open, e.g. after a redirect), without any
 * e-mail (#793): the account is made confirmed by the Auth admin API, then signed in through the
 * e-mail link (see openSignInLink). Then the profile. Ends on the page the sign-in was asked from.
 * Only « a visitor taps « Faire mon premier prono »… » (sign-up.spec.ts) goes through « Recevoir
 * mon code ».
 */
export async function signUp(page: Page, player: { email: string; pseudo: string }) {
  const { error } = await adminClient().auth.admin.createUser({
    email: player.email,
    email_confirm: true,
  });
  if (error) throw new Error(`could not create ${player.email}: ${error.message}`);
  await openSignInLink(page, player.email);
  await page.waitForURL(/\/bienvenue/);
  await page.getByLabel("Ton pseudo").fill(player.pseudo);
  // The bib drawn at random by the welcome page is kept as is.
  await page.getByRole("checkbox", { name: /15 ans/ }).check();
  await page.getByRole("button", { name: "C'est parti : mon premier prono" }).click();
  // The profile exists once the welcome page is left: tests may then change it in SQL.
  await page.waitForURL((url) => !url.pathname.startsWith("/bienvenue"));
}

/** Signs an existing player in again from the sign-in page (already open), without any e-mail. */
export async function signIn(page: Page, email: string) {
  await openSignInLink(page, email);
}

/**
 * Opens the link the sign-in e-mail would carry (/auth/callback, the `next` of the sign-in page
 * kept), made by the Auth admin API: generateLink sends nothing. The app turns it into a session
 * as for a real player; a player without profile is then sent to /bienvenue.
 */
async function openSignInLink(page: Page, email: string) {
  const next = new URL(page.url()).searchParams.get("next") ?? "/";
  const { data, error } = await adminClient().auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data.properties?.hashed_token;
  if (error || !tokenHash) throw new Error(`no sign-in link for ${email}: ${error?.message}`);
  const query = new URLSearchParams({ token_hash: tokenHash, next });
  await page.goto(`/auth/callback?${query}`);
}

let admin: SupabaseClient | undefined;

/**
 * Auth admin client of the test runner (local Supabase, or pre-production in its workflows). The
 * service_role key stays in the runner's environment: it never reaches the browser under test.
 */
function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed (#793)");
  }
  admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
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
