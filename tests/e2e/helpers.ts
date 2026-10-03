import { expect, type Page } from "@playwright/test";
import * as F from "./fixtures/directory";

type Options = {
  /** Hold every Data API response this long, to see the loading state. */
  delay?: number;
  /** Make one table fail, the way a stale schema cache does. */
  fail?: "places" | "companies";
};

/**
 * Serve the fixed directory in place of the Data API, and a signed-out
 * session in place of Neon Auth. Nothing in a test reaches the network
 * except fonts.
 */
export async function useFixtures(page: Page, opts: Options = {}) {
  const tables: Record<string, unknown[]> = {
    companies: F.COMPANIES,
    live_jobs: F.JOBS,
    people: F.PEOPLE,
    places: F.PLACES,
    place_people: F.PLACE_PEOPLE,
    industries: F.INDUSTRIES,
  };

  await page.route(/\.apirest\./, async (route) => {
    const table = new URL(route.request().url()).pathname.split("/").pop()!;
    if (opts.delay) await new Promise((r) => setTimeout(r, opts.delay));
    if (opts.fail === table)
      return route.fulfill({
        status: table === "places" ? 404 : 500,
        contentType: "application/json",
        body: JSON.stringify({
          code: "PGRST205",
          message: `Could not find the table 'public.${table}' in the schema cache`,
        }),
      });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(tables[table] ?? []),
    });
  });

  /* Signed out, with the anonymous token the data client asks for before
     every query. Unsigned: nothing checks it, since the Data API is stubbed
     above. */
  await page.route(/\.neonauth\./, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/token/anonymous")) {
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "anon", role: "anonymous", exp })}.x`;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ token, expires_at: exp }),
      });
    }
    return route.fulfill({ contentType: "application/json", body: "null" });
  });
}

/**
 * Collect console errors and page errors for the test to assert on. A page
 * that looks right while the console is full is not a passing page.
 */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    /* A deliberately failed request in a test logs a resource error; that is
       the test working, not the page breaking. */
    if (/Failed to load resource/.test(text)) return;
    errors.push(text);
  });
  return errors;
}

/** Open the app and wait for the first rows. */
export async function openApp(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.getByRole("button", { name: "Itron" }).first()).toBeVisible();
}

export const tab = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).first().click();
