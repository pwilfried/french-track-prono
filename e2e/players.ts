import type { Page } from "@playwright/test";

import { clearMailbox, latestCodeFromMailbox } from "../src/infra/contract/mailbox";

/** A new invented player: e-mail on example.test, short pseudo. */
export function newPlayer(tag: string) {
  const id = `${Date.now() % 1000000}${Math.floor(Math.random() * 100)}`;
  return { email: `e2e-${tag}-${id}@example.test`, pseudo: `E2E ${tag} ${id}`.slice(0, 24) };
}

/**
 * Signs a new player up from the sign-in page (already open, e.g. after a redirect): e-mail code
 * read in the local mailbox, then the profile. Ends on the page the sign-in was asked from.
 */
export async function signUp(page: Page, player: { email: string; pseudo: string }) {
  await page.getByLabel("Ton e-mail").fill(player.email);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await page.getByLabel(/code/i).fill(await latestCodeFromMailbox(player.email));
  await page.getByRole("button", { name: "Me connecter" }).click();
  await page.waitForURL(/\/bienvenue/);
  await page.getByLabel("Ton pseudo").fill(player.pseudo);
  await page.locator("label", { hasText: "🦅" }).click();
  await page.getByRole("checkbox", { name: /15 ans/ }).check();
  await page.getByRole("button", { name: "Créer mon profil" }).click();
}

/** Signs an existing player in again from the sign-in page (already open), with a fresh code. */
export async function signIn(page: Page, email: string) {
  await clearMailbox(email);
  await page.getByLabel("Ton e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await page.getByLabel(/code/i).fill(await latestCodeFromMailbox(email));
  await page.getByRole("button", { name: "Me connecter" }).click();
}
