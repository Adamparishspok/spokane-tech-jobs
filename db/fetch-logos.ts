/**
 * Fetches each company's logo and stores it in this repository.
 *
 *   bun run db:logos
 *
 * Self-hosted rather than hot-linked, for two reasons. A marker that loads
 * from someone else's CDN disappears the day they rate-limit us, and every
 * reader's browser would be telling that third party which companies they are
 * looking at. Fetching once and committing the file costs a few kilobytes and
 * owes nobody anything.
 *
 * The source is the favicon each company publishes on its own domain, read
 * through Google's icon service at 256px because it already handles the
 * apple-touch-icon / manifest / .ico fallbacks a site might use. DuckDuckGo's
 * equivalent is the second try. A company whose domain serves neither keeps
 * `logo_url` null, and the app draws its monogram instead — which is the same
 * thing it does for a company nobody has added a website for.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  process.exit(1);
}
const sql = neon(url);
const out = new URL("../public/logos/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

const rows = (await sql`
  select id, name, website from companies where website is not null order by name
`) as { id: string; name: string; website: string }[];

const domainOf = (website: string) =>
  website.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

async function grab(domain: string) {
  const sources = [
    `https://www.google.com/s2/favicons?sz=256&domain=${domain}`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
  for (const from of sources) {
    try {
      const res = await fetch(from, { redirect: "follow" });
      if (!res.ok) continue;
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      const ext = EXT[type];
      const bytes = new Uint8Array(await res.arrayBuffer());
      /* Both services answer a domain they have nothing for with a generic
         globe, which is worse than a monogram: it says "this company's mark is
         a globe". The placeholders are tiny, so size is the tell. */
      if (!ext || bytes.byteLength < 500) continue;
      return { ext, bytes, from };
    } catch {
      /* Try the next source. */
    }
  }
  return null;
}

const manifest: Record<string, string> = {};
let found = 0;
for (const c of rows) {
  const domain = domainOf(c.website);
  const got = await grab(domain);
  if (!got) {
    await sql`update companies set logo_url = null where id = ${c.id}`;
    console.log(`  ${c.name.padEnd(22)} none — monogram`);
    continue;
  }
  const file = `${c.id}.${got.ext}`;
  writeFileSync(out + file, got.bytes);
  manifest[c.id] = `/logos/${file}`;
  await sql`update companies set logo_url = ${`/logos/${file}`} where id = ${c.id}`;
  found++;
  console.log(`  ${c.name.padEnd(22)} ${file} (${got.bytes.byteLength} bytes)`);
}

/* The app reads the manifest, not the column.
 *
 * `logo_url` is written above and is in the JSON export, but the Data API
 * caches its schema and a newly added column can take a while to appear in
 * what the browser is served — during which every marker would quietly fall
 * back to a monogram. The manifest is a static file compiled into the bundle,
 * so a logo shows up the moment it is committed, and the column stays right
 * for anyone reading the data. */
writeFileSync(
  new URL("../src/generated/logos.json", import.meta.url).pathname,
  JSON.stringify(manifest, null, 2) + "\n",
);

console.log(`${found} of ${rows.length} companies have a logo`);
