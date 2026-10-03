import { expect, test, type Page } from "@playwright/test";

/**
 * Against real Mapbox tiles and the live directory: the behaviour that made
 * the map feel janky, measured rather than eyeballed. No screenshots here —
 * tiles and data change — only the numbers that should not.
 */

async function ready(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__map?.loaded?.());
  await page.waitForTimeout(800);
}

/** Every easeTo the app issues, with its target zoom. */
async function recordEases(page: Page) {
  await page.evaluate(() => {
    const map = (window as any).__map;
    (window as any).__eases = [];
    const ease = map.easeTo.bind(map);
    map.easeTo = (o: any) => {
      (window as any).__eases.push(o.zoom);
      return ease(o);
    };
  });
}

const zoom = (page: Page) => page.evaluate(() => (window as any).__map.getZoom() as number);

test("the zoom button lands where it aims, in one move", async ({ page }) => {
  await ready(page);
  await recordEases(page);
  const before = await zoom(page);
  await page.getByRole("button", { name: /zoom in/i }).first().click();
  await page.waitForTimeout(1000);
  const eases = await page.evaluate(() => (window as any).__eases as number[]);
  expect(eases).toHaveLength(1);
  expect(await zoom(page)).toBeCloseTo(eases[0], 2);
  expect(await zoom(page)).toBeGreaterThan(before + 0.5);
});

test("wheel zoom is never pulled back mid-gesture", async ({ page }) => {
  await ready(page);
  await recordEases(page);
  await page.mouse.move(900, 450);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(900);
  /* The app has no business issuing a camera move during the reader's own. */
  expect(await page.evaluate(() => (window as any).__eases)).toEqual([]);
});

test("panning does not rebuild the markers", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    (window as any).__adds = 0;
    new MutationObserver((ms) => {
      for (const m of ms)
        for (const n of m.addedNodes)
          if (n instanceof Element && (n.matches("img") || n.querySelector("img")))
            (window as any).__adds++;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.mouse.move(900, 450);
  await page.mouse.down();
  for (let i = 0; i < 60; i++) await page.mouse.move(900 - i * 6, 450, { steps: 1 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  /* A handful entering at the edge is a pan; hundreds is a rebuild. */
  expect(await page.evaluate(() => (window as any).__adds)).toBeLessThan(25);
});
