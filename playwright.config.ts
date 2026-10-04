import { defineConfig, devices } from "@playwright/test";

/**
 * Visual and behavioural tests.
 *
 *   bun run test:e2e            everything
 *   bun run test:e2e:update     re-record the screenshots after a change you meant
 *
 * Two servers. Most tests run against 5210 with Mapbox switched off, so the
 * map is the app's own deterministic basemap and a screenshot only changes
 * when the interface does. The `mapbox` project runs against 5211 with the
 * real token, for what only real tiles can show: camera behaviour and marker
 * churn while panning.
 */
export default defineConfig({
  testDir: "tests/e2e",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "tests/report" }]],
  outputDir: "tests/results",
  expect: {
    toHaveScreenshot: {
      /* Antialiasing differs a hair between runs; layout does not. */
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
    },
  },
  use: {
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: /(mapbox|mobile)\.spec/,
      use: { baseURL: "http://localhost:5210", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "phone",
      testMatch: /(static|visual|mobile)\.spec/,
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: "chrome",
        baseURL: "http://localhost:5210",
      },
    },
    {
      name: "mapbox",
      testMatch: /mapbox\.spec/,
      use: { baseURL: "http://localhost:5211", viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      /* An empty token in the environment wins over .env.local. */
      command: "VITE_MAPBOX_TOKEN= npx vite --port 5210 --strictPort",
      url: "http://localhost:5210",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npx vite --port 5211 --strictPort",
      url: "http://localhost:5211",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
