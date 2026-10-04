import { expect, test } from "@playwright/test";
import { useFixtures } from "./helpers";

/* The phone layout: map first, the list as a sheet, filters as a sheet. Runs
   in the `phone` project only. */
test.beforeEach(async ({ page }) => {
  await useFixtures(page);
  await page.goto("/");
  await expect(page.getByText("3 companies")).toBeVisible();
});

const sheetTop = (page: import("@playwright/test").Page) =>
  page
    .getByRole("region", { name: "Results" })
    .evaluate((el) => el.getBoundingClientRect().top);

test("the list is a sheet over the map, and the button swaps them", async ({ page }) => {
  const half = await sheetTop(page);
  await page.getByRole("button", { name: /^List/ }).click();
  await expect.poll(() => sheetTop(page)).toBeLessThan(half - 100);
  await page.getByRole("button", { name: /^Map/ }).click();
  const vh = page.viewportSize()!.height;
  await expect.poll(() => sheetTop(page)).toBeGreaterThan(vh - 140);
});

test("sections are chips across the top", async ({ page }) => {
  await page.getByRole("button", { name: "Community", exact: true }).click();
  await expect(page.getByText("68 organisations")).toBeVisible();
});

test("filters open full-screen and say how many results they leave", async ({ page }) => {
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByRole("button", { name: "Cleantech", exact: true }).click();
  await expect(page.getByRole("button", { name: /Show 1 company/ })).toBeVisible();
  await page.getByRole("button", { name: /Show 1 company/ }).click();
  await expect(page.getByRole("button", { name: "Filters, 1 on" })).toBeVisible();
  await expect(page.getByText("1 company", { exact: true })).toBeVisible();
});

test("tapping a company opens its detail as a sheet, and it closes", async ({ page }) => {
  await page.getByRole("region", { name: "Results" }).getByRole("button", { name: "Itron" }).click();
  const detail = page.getByRole("dialog", { name: "Details" });
  await expect(detail.getByRole("heading", { name: "Itron", level: 2 })).toBeVisible();
  await detail.getByRole("button", { name: "Close" }).click();
  await expect(detail).toBeHidden();
});

test("the search field is 16px, so iOS does not zoom on focus", async ({ page }) => {
  const size = await page
    .getByRole("searchbox", { name: "Search" })
    .evaluate((el) => getComputedStyle(el).fontSize);
  expect(parseFloat(size)).toBeGreaterThanOrEqual(16);
});
