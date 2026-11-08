import { expect, test } from "@playwright/test";

test("a visitor sees the competition, the next events and reaches the full list", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prochaines épreuves" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navigation principale" }).first(),
  ).toBeAttached();

  await page.getByRole("link", { name: /^Voir les \d+ épreuves$/ }).click();
  await expect(page).toHaveURL(/\/epreuves$/);
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
