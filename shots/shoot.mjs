import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

/**
 * Walks the app and writes shots/out/. Console and page errors are collected
 * and printed at the end — a screenshot that looks right while the console is
 * full is not a passing run.
 *
 * The viewport is 1440×980, the same width the comps in refs/screens/ are
 * exported at, so a column position or a control height can be compared
 * numerically rather than by eye.
 *
 * Without a Mapbox token this run is deterministic: the fallback basemap is
 * geometry rather than tiles, so the same commit produces the same pixels and
 * a geometry regression shows up in a diff. With a token it is not, and that
 * is the trade the token buys.
 */
const OUT = new URL("./out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const APP = "http://localhost:5184/";

const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 980 } });
const errs = [];
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
p.on("pageerror", (e) => errs.push(String(e)));

const shot = (name, opts) =>
  p.screenshot({ path: OUT + name + ".png", ...opts });

const go = async (hash = "") => {
  await p.goto(APP + hash, { waitUntil: "networkidle" });
  /* The route is chosen at mount, so a hash-only change is not a navigation. */
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(500);
};

const click = async (role, name, wait = 500) => {
  await p.getByRole(role, { name }).first().click();
  await p.waitForTimeout(wait);
};

/* ---- specimen ---------------------------------------------------------- */

await go("#specimen");
await shot("specimen", { fullPage: true });
await click("radio", "Dark", 500);
await shot("specimen-dark", { fullPage: true });
await click("radio", "Light", 400);

/* ---- companies --------------------------------------------------------- */

await go();
await shot("companies");

/* A company selected: the detail column opens and the map eases the pin into
   the gap between the two panels rather than under one of them. */
await click("button", /Latah Systems/, 900);
await shot("company-detail");

await click("tab", /^Jobs/, 500);
await shot("company-jobs");
await click("tab", /^People/, 500);
await shot("company-people");

/* An unclaimed listing says so, and offers the one action that fixes it. */
await go();
await click("button", /Manito Bio/, 900);
await shot("company-unclaimed");

/* ---- filters ----------------------------------------------------------- */

await go();
await click("button", /^Hiring$/, 600);
await shot("companies-hiring");

await go();
await click("button", /^Industry$/, 350);
await shot("filter-open");
await click("checkbox", /Health tech/, 500);
await p.keyboard.press("Escape");
await p.waitForTimeout(400);
await shot("companies-filtered");

/* The dead end: a combination that matches nothing, and what it offers. */
await go();
await p.getByPlaceholder(/Search companies/).fill("submarine");
await p.waitForTimeout(500);
await shot("companies-empty-search");

/* ---- jobs -------------------------------------------------------------- */

await go();
await click("button", "Jobs", 700);
await shot("jobs");

await click("button", /Senior Backend Engineer, Scheduling/, 900);
await shot("job-detail");

await go();
await click("button", "Jobs", 600);
await click("button", /^Discipline$/, 350);
await click("checkbox", /^Design$/, 500);
await p.keyboard.press("Escape");
await p.waitForTimeout(400);
await shot("jobs-design");

/* ---- people ------------------------------------------------------------ */

await go();
await click("button", "People", 700);
await shot("people");

await click("button", /Daniel Reyes/, 900);
await shot("person-detail");

await go();
await click("button", "People", 600);
await click("button", /Open to work/, 600);
await shot("people-open");

/* ---- the forms --------------------------------------------------------- */

await go();
await click("button", /^Add$/, 700);
await shot("add-company", { fullPage: false });

await go();
await click("button", "Jobs", 600);
await click("button", /Post a job/, 700);
await shot("post-job");
/* The pay range is required, so the disabled state is the interesting half. */
await p.getByLabel("Pay range").fill("145000");
await p.getByLabel("Maximum pay").fill("90000");
await p.waitForTimeout(400);
await shot("post-job-bad-range");

await go();
await click("button", "People", 600);
await click("button", /^Profile$/, 700);
await shot("profile");

/* ---- signed out -------------------------------------------------------- */

await go("#auth");
await shot("auth-signin");
await click("button", /Create an account/, 500);
await shot("auth-signup");
await p.getByLabel("Email").fill("kasey@kystudio.co");
await p.getByLabel("Password").fill("ponderosa8");
await p.waitForTimeout(400);
await shot("auth-signup-valid");
await click("button", /Create account/, 500);
await shot("auth-sent");
await click("button", /Open the link/, 500);
await shot("auth-confirmed");

await go("#auth");
await click("button", /Forgot your password/, 500);
await shot("auth-forgot");

/* ---- the first day ----------------------------------------------------- */

await go("#empty");
await shot("empty");
await click("button", "Jobs", 500);
await shot("empty-jobs");
await click("button", "People", 500);
await shot("empty-people");

/* ---- dark -------------------------------------------------------------- */

/* Switched on the specimen, then walked through the screens carrying the most
   surface: the map, a detail column, a form, and the signed-out card. */
await go("#specimen");
await click("radio", "Dark", 500);

await go();
await shot("dark-companies");
await click("button", /Latah Systems/, 900);
await shot("dark-company-detail");

await go();
await click("button", "Jobs", 600);
await click("button", /Senior Backend Engineer, Scheduling/, 900);
await shot("dark-job-detail");

await go();
await click("button", /^Add$/, 700);
await shot("dark-add-company");

await go("#auth");
await shot("dark-auth");

await go("#empty");
await shot("dark-empty");

/* Back to light, so a re-run starts where the light shots expect it. */
await go("#specimen");
await click("radio", "Light", 400);

if (errs.length) console.log("ERRORS:\n" + errs.join("\n"));
else console.log("ok — no console errors");
await b.close();
