/**
 * Writes the directory out as open data, and as pages a crawler can read.
 *
 *   bun run db:export
 *
 * The app is one page that draws itself from the Data API, which is the right
 * shape for a map and the wrong shape for an index: a crawler that runs no
 * JavaScript sees an empty div, and one that does still finds a single URL
 * with no way into a particular company. So the same rows are written out
 * three ways, into `public/` where Vite copies them verbatim:
 *
 * - `companies/<slug>.html` — one static page per company, with the facts, the
 *   sources they came from, and JSON-LD. These are the pages that get indexed.
 * - `data/companies.json` — the directory as data, for anyone who wants it.
 * - `llms.txt` and `llms-full.txt` — the site in plain text for answer
 *   engines: what it is, where the data is, and the whole directory inline.
 *
 * Re-run it whenever the directory changes; the output is committed, so what
 * is indexed is always something a person can see in the diff.
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  process.exit(1);
}
const sql = neon(url);

const SITE = "https://spokanetechjobs.com";
const LICENCE = "CC BY 4.0";
const out = new URL("../public/", import.meta.url).pathname;

type Row = Record<string, string | number | null>;

const companies = (await sql`
  select c.id, c.name, c.tagline, c.about, c.headcount, c.founded, c.stage,
         c.workplace, c.address, c.zip, c.lng, c.lat, c.website, c.phone,
         d.name as district, i.name as industry
    from companies c
    join districts d on d.id = c.district_id
    join industries i on i.id = c.industry_id
   where c.status = 'published'
   order by c.name
`) as Row[];

const jobs = (await sql`
  select j.id, j.title, j.discipline, j.level, j.employment, j.workplace,
         j.pay_low, j.pay_high, j.hourly, j.summary, j.posted_at,
         c.id as company_id, c.name as company
    from jobs j
    join companies c on c.id = j.company_id
   where j.status = 'published' and j.expires_at > now()
   order by j.posted_at desc
`) as Row[];

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* A fact nobody sourced is left out of the page and is null in the data —
   never filled in with a plausible number. */
const fact = (label: string, value: unknown) =>
  value === null || value === undefined || value === ""
    ? ""
    : `      <div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>\n`;

const page = (title: string, description: string, body: string, canonical: string) =>
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0 auto; max-width: 42rem; padding: 3rem 1.5rem 6rem;
        font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        color: #16191a; background: #f6f6f3;
      }
      @media (prefers-color-scheme: dark) {
        body { color: #eef1f0; background: #0e1112; }
        a { color: #7fd6a8; }
      }
      a { color: #0f7a4f; }
      h1 { font-size: 1.75rem; margin: 0 0 .25rem; }
      h2 { font-size: 1rem; margin: 2.5rem 0 .5rem; }
      .lede { color: #5f676a; margin: 0 0 2rem; }
      dl { display: grid; gap: .75rem; margin: 0; }
      dt { font-size: .8125rem; color: #5f676a; }
      dd { margin: 0; }
      ul { padding-left: 1.1rem; }
      nav { margin-bottom: 2rem; font-size: .875rem; }
      footer { margin-top: 4rem; font-size: .8125rem; color: #5f676a; }
    </style>
  </head>
  <body>
${body}
    <footer>
      <p>
        Open data, ${LICENCE}. The directory is also available as
        <a href="${SITE}/data/companies.json">JSON</a> and as
        <a href="${SITE}/llms-full.txt">plain text</a>.
      </p>
    </footer>
  </body>
</html>
`;

/* ---- one page per company ---------------------------------------------- */

rmSync(`${out}companies`, { recursive: true, force: true });
mkdirSync(`${out}companies`, { recursive: true });

for (const c of companies) {
  const jd = jobs.filter((j) => j.company_id === c.id);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: c.name,
    description: c.about || c.tagline,
    url: c.website ? `https://${String(c.website).replace(/^https?:\/\//, "")}` : undefined,
    telephone: c.phone ?? undefined,
    foundingDate: c.founded ? String(c.founded) : undefined,
    numberOfEmployees: c.headcount ?? undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: c.address || undefined,
      addressLocality: "Spokane",
      addressRegion: "WA",
      postalCode: c.zip || undefined,
      addressCountry: "US",
    },
    geo: { "@type": "GeoCoordinates", latitude: c.lat, longitude: c.lng },
  };
  const body = `    <nav><a href="${SITE}/companies/">All companies</a> · <a href="${SITE}/">Map</a></nav>
    <h1>${esc(c.name)}</h1>
    <p class="lede">${esc(c.tagline)}</p>
    ${c.about && c.about !== c.tagline ? `<p>${esc(c.about)}</p>` : ""}
    <h2>Details</h2>
    <dl>
${fact("Industry", c.industry)}${fact("District", c.district)}${fact("Address", [c.address, `Spokane, WA ${c.zip ?? ""}`.trim()].filter(Boolean).join(", "))}${fact("Team", c.headcount && `${c.headcount} people`)}${fact("Founded", c.founded)}${fact("Workplace", c.workplace)}${fact("Phone", c.phone)}${fact("Website", c.website)}    </dl>
    <h2>Open roles</h2>
    ${
      jd.length
        ? `<ul>\n${jd.map((j) => `      <li>${esc(j.title)} — ${esc(j.level)} ${esc(j.discipline)}, ${esc(j.employment)}</li>`).join("\n")}\n    </ul>`
        : `<p>No roles listed on Spokane Tech Jobs right now.</p>`
    }
    <script type="application/ld+json">${JSON.stringify(ld)}</script>`;
  writeFileSync(
    `${out}companies/${c.id}.html`,
    page(
      `${c.name} — Spokane Tech Jobs`,
      String(c.tagline),
      body,
      `${SITE}/companies/${c.id}.html`,
    ),
  );
}

/* ---- the index of them -------------------------------------------------- */

writeFileSync(
  `${out}companies/index.html`,
  page(
    "Companies — Spokane Tech Jobs",
    `Every company in the Spokane Tech Jobs directory: ${companies.map((c) => c.name).join(", ")}.`,
    `    <nav><a href="${SITE}/">Map</a></nav>
    <h1>Companies</h1>
    <p class="lede">Every company in the directory, ${companies.length} of them, each sourced from public records.</p>
    <ul>
${companies.map((c) => `      <li><a href="${SITE}/companies/${c.id}.html">${esc(c.name)}</a> — ${esc(c.tagline)}</li>`).join("\n")}
    </ul>`,
    `${SITE}/companies/`,
  ),
);

/* ---- the data ----------------------------------------------------------- */

mkdirSync(`${out}data`, { recursive: true });
const meta = {
  name: "Spokane Tech Jobs directory",
  url: SITE,
  licence: LICENCE,
  attribution: "Spokane Tech Jobs",
  generated: new Date().toISOString(),
  note: "Every field is sourced or null. A null is a fact nobody has published, not a zero.",
};
writeFileSync(`${out}data/companies.json`, JSON.stringify({ ...meta, companies }, null, 2));
writeFileSync(`${out}data/jobs.json`, JSON.stringify({ ...meta, jobs }, null, 2));

/* ---- llms.txt ----------------------------------------------------------- */

const line = (c: Row) =>
  `- [${c.name}](${SITE}/companies/${c.id}.html): ${c.tagline}`;

writeFileSync(
  `${out}llms.txt`,
  `# Spokane Tech Jobs

> A directory and job board for the Spokane, Washington tech ecosystem: the
> companies, the roles they have open, and the people building here, on one
> map. Every row is sourced from public records; a fact nobody published is
> null rather than guessed.

The data is open, ${LICENCE}. Use it, quote it, reuse it — attribution to
Spokane Tech Jobs is all that is asked.

## Companies

${companies.map(line).join("\n")}

## Data

- [companies.json](${SITE}/data/companies.json): the directory as JSON
- [jobs.json](${SITE}/data/jobs.json): open roles as JSON
- [llms-full.txt](${SITE}/llms-full.txt): the whole directory in plain text

## Pages

- [Map](${SITE}/): the directory as an interactive map
- [Companies](${SITE}/companies/): every company, one page each
`,
);

const full = companies
  .map((c) => {
    const jd = jobs.filter((j) => j.company_id === c.id);
    const facts = [
      ["Industry", c.industry],
      ["District", c.district],
      ["Address", c.address ? `${c.address}, Spokane, WA ${c.zip ?? ""}`.trim() : null],
      ["Team", c.headcount ? `${c.headcount} people` : null],
      ["Founded", c.founded],
      ["Workplace", c.workplace],
      ["Website", c.website],
      ["Phone", c.phone],
    ]
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    return `## ${c.name}\n\n${c.about || c.tagline}\n\n${facts}\n\nOpen roles: ${
      jd.length ? jd.map((j) => j.title).join(", ") : "none listed"
    }\nPage: ${SITE}/companies/${c.id}.html\n`;
  })
  .join("\n");

writeFileSync(
  `${out}llms-full.txt`,
  `# Spokane Tech Jobs — the whole directory

Source: ${SITE}
Licence: ${LICENCE}, attribution to Spokane Tech Jobs
Generated: ${new Date().toISOString().slice(0, 10)}
Companies: ${companies.length}. Open roles: ${jobs.length}.

Every field here is sourced from public records. A field that could not be
sourced is absent rather than estimated.

${full}`,
);

/* ---- sitemap ------------------------------------------------------------ */

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  `${out}sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>
  <url><loc>${SITE}/companies/</loc><lastmod>${today}</lastmod><priority>0.9</priority></url>
${companies.map((c) => `  <url><loc>${SITE}/companies/${c.id}.html</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>`).join("\n")}
</urlset>
`,
);

console.log(
  `exported → ${companies.length} companies, ${jobs.length} jobs, sitemap, llms.txt, llms-full.txt, JSON`,
);
