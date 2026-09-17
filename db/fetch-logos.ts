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
 * Three sources, in order of how good the result is:
 *
 * 1. The company's own page, read for `<link rel="apple-touch-icon">` and
 *    friends, largest declared size first. This is the only one that reliably
 *    yields something bigger than a favicon — an apple-touch-icon is 180px or
 *    better by convention, and a 16px .ico rendered at 32 is a smudge.
 * 2. Google's icon service at 256px, which handles sites whose markup hides
 *    the icon behind a manifest.
 * 3. DuckDuckGo's, which sometimes has one when Google does not.
 *
 * A company whose domain serves none of them keeps `logo_url` null and the app
 * draws its monogram — the same thing it does for a listing nobody has added a
 * website for.
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

/** Icons a page declares, biggest first. */
async function declared(domain: string): Promise<string[]> {
  for (const base of [`https://${domain}`, `https://www.${domain}`]) {
    try {
      const res = await fetch(base, { redirect: "follow" });
      if (!res.ok) continue;
      const html = (await res.text()).slice(0, 200_000);
      const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
      const icons: { href: string; size: number }[] = [];
      for (const tag of links) {
        const rel = /rel=["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase() ?? "";
        if (!/(^|\s)(apple-touch-icon|icon|shortcut icon|mask-icon)(\s|$)/.test(rel)) continue;
        const href = /href=["']?([^"'>\s]+)/i.exec(tag)?.[1];
        if (!href) continue;
        const sizes = /sizes=["']?(\d+)x/i.exec(tag)?.[1];
        /* An apple-touch-icon with no declared size is 180 by convention, and
           is still a better bet than a 16px favicon that says it is 16. */
        const size = sizes ? Number(sizes) : rel.includes("apple") ? 180 : 0;
        icons.push({ href: new URL(href, res.url).toString(), size });
      }
      if (icons.length)
        return icons.sort((a, b) => b.size - a.size).map((i) => i.href);
    } catch {
      /* Try www, then the icon services. */
    }
  }
  return [];
}

/**
 * Every candidate, then the best of them.
 *
 * "Best" is the largest file. Byte size is a proxy for pixel size, and a
 * coarse one, but it is right about the thing that matters here: a 16px
 * favicon and a 256px apple-touch-icon are two orders of magnitude apart, and
 * the small one looks like a smudge in a 32px circle.
 */
async function grab(domain: string) {
  const candidates: { url: string; own: boolean }[] = [
    ...(await declared(domain)).map((url) => ({ url, own: true })),
    { url: `https://www.google.com/s2/favicons?sz=256&domain=${domain}`, own: false },
    { url: `https://icons.duckduckgo.com/ip3/${domain}.ico`, own: false },
  ];

  let best: { ext: string; bytes: Uint8Array; from: string } | null = null;
  for (const { url: from, own } of candidates.slice(0, 6)) {
    try {
      const res = await fetch(from, { redirect: "follow" });
      if (!res.ok) continue;
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      const ext = EXT[type];
      if (!ext) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      /* The icon services answer a domain they have nothing for with a generic
         globe, which is worse than a monogram: it says "this company's mark is
         a globe". The placeholders are tiny, so size is the tell — and it is
         only a tell for them, since an icon a company declares on its own page
         is that company's mark however small. */
      if (!own && bytes.byteLength < 500) continue;
      if (!best || bytes.byteLength > best.bytes.byteLength)
        best = { ext, bytes, from };
    } catch {
      /* Try the next candidate. */
    }
  }

  /* A 16px .ico is all some domains publish. Blown up to a 32px marker it is a
     smudge that reads as "broken image" rather than as a logo, and the
     monogram is the better mark — so below the bar, there is no logo. */
  if (best && best.ext === "ico" && best.bytes.byteLength < 2500) return null;
  return best;
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
