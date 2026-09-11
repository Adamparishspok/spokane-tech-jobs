/**
 * Seeds the directory from src/seed-data.ts.
 *
 *   bun run db:seed
 *
 * This is the prototype's dataset, moved from being the app's source of truth
 * to being its starting contents. Everything it writes is `status =
 * 'published'` and unclaimed: the seed companies are on the map, and the first
 * person from one of them to sign in claims the listing through the same flow
 * everybody else uses. Nothing here is privileged except that it ran once.
 *
 * Idempotent by upsert, so re-running it restores the seed rows without
 * touching anything a real user has since added.
 */
import { neon } from "@neondatabase/serverless";
import {
  COMPANIES,
  INDUSTRIES,
  JOBS,
  PEOPLE,
  type Industry,
} from "../src/seed-data";
import { DISTRICTS } from "../src/map/spokane";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  process.exit(1);
}

const sql = neon(url);

/** "Health tech" → "health-tech". The id the companies table points at. */
const industryId = (name: Industry) =>
  name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

console.log(`seeding → ${new URL(url).host}`);

/* --- reference ---------------------------------------------------------- */

for (const [i, d] of DISTRICTS.entries()) {
  await sql`
    insert into districts (id, name, lng, lat, min_zoom, sort)
    values (${d.id}, ${d.name}, ${d.at.lng}, ${d.at.lat}, ${d.minZoom}, ${i})
    on conflict (id) do update set
      name = excluded.name,
      lng = excluded.lng,
      lat = excluded.lat,
      min_zoom = excluded.min_zoom,
      sort = excluded.sort
  `;
}
console.log(`  districts  ${DISTRICTS.length}`);

for (const [i, name] of INDUSTRIES.entries()) {
  await sql`
    insert into industries (id, name, sort)
    values (${industryId(name)}, ${name}, ${i})
    on conflict (id) do update set name = excluded.name, sort = excluded.sort
  `;
}
console.log(`  industries ${INDUSTRIES.length}`);

/* --- companies ---------------------------------------------------------- */

for (const c of COMPANIES) {
  await sql`
    insert into companies (
      id, name, tagline, about, hue, industry_id, headcount, founded,
      stage, workplace, district_id, address, zip, lng, lat,
      website, email, phone, status
    ) values (
      ${c.id}, ${c.name}, ${c.tagline}, ${c.about}, ${c.hue},
      ${industryId(c.industry)}, ${c.headcount}, ${c.founded},
      ${c.stage}::funding_stage, ${c.workplace}::workplace, ${c.district},
      ${c.address}, ${c.zip}, ${c.lng}, ${c.lat},
      ${c.website}, ${c.email}, ${c.phone}, 'published'
    )
    on conflict (id) do update set
      name = excluded.name,
      tagline = excluded.tagline,
      about = excluded.about,
      hue = excluded.hue,
      industry_id = excluded.industry_id,
      headcount = excluded.headcount,
      founded = excluded.founded,
      stage = excluded.stage,
      workplace = excluded.workplace,
      district_id = excluded.district_id,
      address = excluded.address,
      zip = excluded.zip,
      lng = excluded.lng,
      lat = excluded.lat,
      website = excluded.website,
      email = excluded.email,
      phone = excluded.phone
  `;
}
console.log(`  companies  ${COMPANIES.length}`);

/* --- jobs ---------------------------------------------------------------
 *
 * `posted` in the seed data is "days ago", which was the right shape when the
 * data was a fixture and is the wrong shape in a database: a fixture is read
 * the day it is written, and a row is read for as long as it exists. It is
 * converted to a real timestamp here, and expiry is measured from that — so a
 * listing seeded as "40 days ago" has twenty days left on it, exactly as it
 * would if somebody had actually posted it then.
 */

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

for (const j of JOBS) {
  const postedAt = daysAgo(j.posted);
  const expiresAt = daysAgo(j.posted - 60);
  await sql`
    insert into jobs (
      id, company_id, title, discipline, level, employment, workplace,
      pay_low, pay_high, hourly, summary, responsibilities, requirements,
      status, posted_at, expires_at
    ) values (
      ${uuidFor(j.id)}, ${j.companyId}, ${j.title}, ${j.discipline}::discipline,
      ${j.level}::seniority, ${j.employment}::employment,
      ${j.workplace}::workplace, ${j.payLow}, ${j.payHigh},
      ${j.hourly ?? false}, ${j.summary}, ${j.responsibilities},
      ${j.requirements}, 'published', ${postedAt}, ${expiresAt}
    )
    on conflict (id) do update set
      title = excluded.title,
      discipline = excluded.discipline,
      level = excluded.level,
      employment = excluded.employment,
      workplace = excluded.workplace,
      pay_low = excluded.pay_low,
      pay_high = excluded.pay_high,
      hourly = excluded.hourly,
      summary = excluded.summary,
      responsibilities = excluded.responsibilities,
      requirements = excluded.requirements,
      posted_at = excluded.posted_at,
      expires_at = excluded.expires_at
  `;
}
console.log(`  jobs       ${JOBS.length}`);

/* --- people -------------------------------------------------------------- */

for (const p of PEOPLE) {
  await sql`
    insert into people (
      id, name, hue, role, company_id, district_id, open_to, skills, bio,
      years, listed
    ) values (
      ${p.id}, ${p.name}, ${p.hue}, ${p.role}, ${p.companyId},
      ${p.district}, ${p.openTo}, ${p.skills}, ${p.bio}, ${p.years}, true
    )
    on conflict (id) do update set
      name = excluded.name,
      hue = excluded.hue,
      role = excluded.role,
      company_id = excluded.company_id,
      district_id = excluded.district_id,
      open_to = excluded.open_to,
      skills = excluded.skills,
      bio = excluded.bio,
      years = excluded.years
  `;
}
console.log(`  people     ${PEOPLE.length}`);

/**
 * The jobs table keys on uuid, and the seed data keys on slugs like
 * "latah-be". Hashing the slug into a v5-shaped uuid keeps the seed
 * idempotent — the same slug always produces the same row — without putting a
 * second id column on the table for the benefit of a one-off script.
 */
function uuidFor(slug: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < slug.length; i++) {
    h1 = Math.imul(h1 ^ slug.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 + slug.charCodeAt(i), 2246822519) >>> 0;
  }
  const hex = (n: number) => n.toString(16).padStart(8, "0");
  const a = hex(h1);
  const b = hex(h2);
  const c = hex((h1 ^ h2) >>> 0);
  const d = hex(Math.imul(h1, h2) >>> 0);
  /* Version 5, variant 10xx, so it is a well-formed uuid rather than a
     hex string Postgres happens to accept. */
  return `${a}-${b.slice(0, 4)}-5${b.slice(5, 8)}-a${c.slice(1, 4)}-${c.slice(4)}${d}`;
}

console.log("ok");
