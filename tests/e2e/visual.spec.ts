import { expect, test } from "@playwright/test";
import { openApp, tab, useFixtures } from "./helpers";

/* Screenshots of the app against the fixed directory and the built-in
   basemap, so a diff means the interface changed. Re-record with
   `bun run test:e2e:update` after a change you meant. */
test.beforeEach(async ({ page }) => {
  await useFixtures(page);
  await openApp(page);
  await page.evaluate(() => document.fonts.ready);
});

test("companies", async ({ page }) => {
  await expect(page).toHaveScreenshot("companies.png");
});

test("company detail", async ({ page }) => {
  await page.getByRole("button", { name: "Itron" }).first().click();
  await page.waitForTimeout(700);
  await expect(page).toHaveScreenshot("company-detail.png");
});

test("community", async ({ page }) => {
  await tab(page, "Community");
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot("community.png");
});

test("region view", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "zoom controls are a desktop affordance");
  const out = page.getByRole("button", { name: /zoom out/i }).first();
  while (await out.isEnabled()) await out.click();
  await page.waitForTimeout(600);
  await expect(page).toHaveScreenshot("region.png");
});
