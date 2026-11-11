import { expect, test } from "@playwright/test";

test("the legal pages are one tap away from the footer, signed in or not", async ({ page }) => {
  await page.goto("/connexion");

  await page.getByRole("contentinfo").getByRole("link", { name: "Confidentialité" }).click();
  await expect(page).toHaveURL(/\/confidentialite$/);
  await expect(page.getByRole("heading", { name: "15 ans ou plus" })).toBeVisible();

  await page.getByRole("contentinfo").getByRole("link", { name: "Mentions légales" }).click();
  await expect(page).toHaveURL(/\/mentions-legales$/);
  await expect(page.getByRole("heading", { name: "Contact" })).toBeVisible();
});

test("the footer's Contact link writes an e-mail straight away", async ({ page }) => {
  await page.goto("/connexion");

  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Contact", exact: true }),
  ).toHaveAttribute("href", "mailto:frenchtrackprono@gmail.com");
});

test("the footer links to FrenchTrack's accounts in a new tab", async ({ page }) => {
  await page.goto("/connexion");

  const social = page.getByRole("navigation", { name: "FrenchTrack sur les réseaux" });
  for (const [name, href] of [
    ["Instagram", "https://www.instagram.com/frenchtrack"],
    ["YouTube", "https://www.youtube.com/@French_Track"],
    ["TikTok", "https://www.tiktok.com/@french.track"],
    ["Le podcast", "https://podcastics.com/podcast/french-track"],
  ]) {
    const link = social.getByRole("link", { name: `${name} (nouvel onglet)` });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link.locator("svg")).toHaveAttribute("aria-hidden", "true");
    expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
});
