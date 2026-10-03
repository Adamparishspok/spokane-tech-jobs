import { expect, test } from "@playwright/test";

/* Vite's dev server serves public/ files by exact path, so these use the
   file names; production serves the same files at /employers/ and so on. */
const PAGES = [
  ["employers", "/employers/index.html", /Get your open roles/],
  ["terms", "/terms/index.html", /Terms of Use/],
  ["privacy", "/privacy/index.html", /Privacy Policy/],
  ["not-found", "/404.html", /doesn't go anywhere/],
] as const;

for (const [name, path, heading] of PAGES) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${name} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      /* Nothing wider than the screen: the commonest way a page breaks on a phone. */
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${name}-${scheme}.png`, { fullPage: true });
    });
  }
}

test("employer calls to action open the right forms", async ({ page }) => {
  await page.goto("/employers/index.html");
  await expect(page.getByRole("link", { name: "Post a job" }).first()).toHaveAttribute("href", "/#post-job");
  await expect(page.getByRole("link", { name: "Add your company" }).first()).toHaveAttribute("href", "/#add-company");
});
