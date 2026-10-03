import { expect, test } from "@playwright/test";
import { openApp, tab, useFixtures, watchErrors } from "./helpers";

test.describe("the directory", () => {
  test.beforeEach(async ({ page }) => useFixtures(page));

  test("loads with no console errors", async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await expect(page.getByText("3 companies")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("every tab lists its rows", async ({ page }) => {
    await openApp(page);
    await tab(page, "Jobs");
    await expect(page.getByRole("button", { name: /Senior Firmware Engineer/ })).toBeVisible();
    await tab(page, "People");
    await expect(page.getByRole("button", { name: "Nick Smoot" })).toBeVisible();
    await tab(page, "Community");
    await expect(page.getByText("2 places")).toBeVisible();
  });

  test("selecting a company opens its detail, Escape closes it", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: "Itron" }).first().click();
    const detail = page.getByRole("heading", { name: "Itron", level: 2 });
    await expect(detail).toBeVisible();
    await expect(page.getByText("Liberty Lake, WA")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(detail).toBeHidden();
  });
});

test.describe("loading and failure", () => {
  test("loading shows placeholder rows, never an empty directory", async ({ page }) => {
    await useFixtures(page, { delay: 1500 });
    await page.goto("/");
    await expect(page.getByLabel("Loading")).toBeVisible();
    await expect(page.getByText(/0 companies|No companies|Nothing on the map/)).toHaveCount(0);
    await expect(page.getByText("3 companies")).toBeVisible();
    await expect(page.getByLabel("Loading")).toBeHidden();
  });

  test("a missing places table empties Community, not the whole app", async ({ page }) => {
    await useFixtures(page, { fail: "places" });
    await openApp(page);
    await tab(page, "Community");
    await expect(page.getByText("Can't reach the directory")).toHaveCount(0);
  });

  test("an unreachable directory says so, rather than looking empty", async ({ page }) => {
    await useFixtures(page, { fail: "companies" });
    await page.goto("/");
    await expect(page.getByText("Can't reach the directory")).toBeVisible();
  });
});

test.describe("community and people", () => {
  test.beforeEach(async ({ page }) => useFixtures(page));

  test("kind filters narrow the list", async ({ page }) => {
    await openApp(page);
    await tab(page, "Community");
    await page.getByRole("button", { name: "Meetups" }).click();
    await expect(page.getByText("1 place", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "DC509" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Indaba/ })).toHaveCount(0);
  });

  test("a place links to the people there, and back", async ({ page }) => {
    await openApp(page);
    await tab(page, "Community");
    await page.getByRole("button", { name: /Indaba Coffee/ }).first().click();
    await expect(page.getByText("People here")).toBeVisible();
    await page.getByRole("button", { name: /Nick Smoot/ }).last().click();
    await expect(page.getByRole("heading", { name: "Nick Smoot", level: 2 })).toBeVisible();
    await expect(page.getByText("Around the community")).toBeVisible();
  });

  test("an unclaimed profile states only what is known", async ({ page }) => {
    await openApp(page);
    await tab(page, "People");
    await page.getByRole("button", { name: "Nick Smoot" }).click();
    await expect(page.getByText("Are you Nick?")).toBeVisible();
    for (const invented of ["Between roles", "0 years", "Get in touch"])
      await expect(page.getByText(invented)).toHaveCount(0);
  });

  test("a claimed profile shows its own facts", async ({ page }) => {
    await openApp(page);
    await tab(page, "People");
    await page.getByRole("button", { name: "Avery Tester" }).click();
    await expect(page.getByText("Logan, Spokane, WA")).toBeVisible();
    await expect(page.getByRole("button", { name: /Get in touch/ })).toBeVisible();
  });
});
