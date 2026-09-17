/**
 * Replaces the prototype's invented directory with sourced companies.
 *
 *   bun run db:load-real
 *
 * `db/research/real-companies.json` is nine Spokane-area employers researched
 * from public sources, each row carrying the URLs it came from. This script
 * writes them and deletes the seed — the fictional companies, and the jobs and
 * people hung off them — in one pass.
 *
 * Two fields are decided here rather than read from the file, and both are
 * classification rather than fact:
 *
 * - `industry` is chosen from the company's own sourced description. The
 *   mapping is written out below so it can be argued with.
 * - `hue` is hashed from the name, because the monogram tile needs a colour
 *   and nobody sourced one.
 *
 * Everything else that is not in the research file stays null. The file's own
 * note is the rule: "a field that could not be sourced is null, and null is
 * the correct value to ship rather than a plausible guess."
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { COMPANIES as SEED } from "../src/seed-data";
import { INDUSTRIES } from "../src/domain";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  process.exit(1);
}
const sql = neon(url);

type Researched = {
  name: string;
  website: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  district: string;
  lng: number;
  lat: number;
  phone: string | null;
  founded: number | null;
  headcount: number | null;
  what: string;
  sources: string[];
};

const file = JSON.parse(
  readFileSync(new URL("./research/real-companies.json", import.meta.url), "utf8"),
) as { companies: Researched[] };

/** Chosen from each company's sourced description — see the header. */
const INDUSTRY: Record<string, string> = {
  Itron: "Cleantech",
  "Key Tronic": "Advanced manufacturing",
  "Corporate Tools": "Business software",
  "ENGIE Impact": "Data & analytics",
  Avista: "Cleantech",
  IntelliTect: "IT services",
  Nuvodia: "IT services",
  "Commerce Architects": "E-commerce",
  Spiceology: "E-commerce",
};

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const industryId = slug;

/** A stable hue per name, so the monogram tile does not change on re-runs. */
const hueOf = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
};

/**
 * The tagline is the sourced sentence, trimmed of its full stop. Only a
 * description long enough to crowd a list row falls back to its first clause —
 * and that is a trim, not a rewrite.
 */
const taglineOf = (what: string) => {
  const line = what.replace(/\s+/g, " ").trim().replace(/\.$/, "");
  if (line.length <= 140) return line;
  const head = line.split(/[:.]/)[0].trim();
  return head.length >= 24 ? head : line.slice(0, 137).trimEnd() + "…";
};

console.log(`loading → ${new URL(url).host}`);

for (const [i, name] of INDUSTRIES.entries()) {
  await sql`
    insert into industries (id, name, sort)
    values (${industryId(name)}, ${name}, ${i})
    on conflict (id) do update set name = excluded.name, sort = excluded.sort
  `;
}

for (const c of file.companies) {
  const industry = INDUSTRY[c.name];
  if (!industry) throw new Error(`No industry chosen for ${c.name}`);
  await sql`
    insert into companies (
      id, name, tagline, about, hue, industry_id, headcount, founded,
      stage, workplace, district_id, address, zip, lng, lat,
      website, email, phone, status
    ) values (
      ${slug(c.name)}, ${c.name}, ${taglineOf(c.what)}, ${c.what},
      ${hueOf(c.name)}, ${industryId(industry)}, ${c.headcount}, ${c.founded},
      null, null, ${c.district}, ${c.address ?? ""}, ${c.zip ?? ""},
      ${c.lng}, ${c.lat}, ${c.website}, null, ${c.phone}, 'published'
    )
    on conflict (id) do update set
      name = excluded.name,
      tagline = excluded.tagline,
      about = excluded.about,
      industry_id = excluded.industry_id,
      headcount = excluded.headcount,
      founded = excluded.founded,
      district_id = excluded.district_id,
      address = excluded.address,
      zip = excluded.zip,
      lng = excluded.lng,
      lat = excluded.lat,
      website = excluded.website,
      phone = excluded.phone,
      status = 'published'
  `;
}
console.log(`  companies  ${file.companies.length} sourced`);

/* --- out with the invented ----------------------------------------------
 *
 * Only the seed's own ids, so anything a real person has since added through
 * the app survives. A claimed seed row would be a person attached to a company
 * that never existed, so claims go with it.
 */
const seedIds = SEED.map((c) => c.id);
const jobs = await sql`delete from jobs where company_id = any(${seedIds}) returning id`;
const people = await sql`delete from people where company_id = any(${seedIds}) returning id`;
const claims = await sql`delete from claims where company_id = any(${seedIds}) returning id`;
const gone = await sql`delete from companies where id = any(${seedIds}) returning id`;
console.log(`  removed    ${gone.length} companies, ${jobs.length} jobs, ${people.length} people, ${claims.length} claims`);

const [{ count }] = await sql`select count(*)::int as count from companies`;
console.log(`  directory  ${count} companies`);
console.log("ok");
