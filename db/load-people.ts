/**
 * Lists people somebody else added, from research/people.json.
 *
 *   bun run db:people
 *
 * A row here is a profile its subject has not claimed yet, so it carries only
 * what is sourced — and an email, if one is known, that lets them take it
 * over (claim_person in schema.sql). The email goes to `person_emails`, which
 * nothing outside that function can read.
 *
 * A profile its subject has already claimed is theirs: this script never
 * overwrites it, only links it to places.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  process.exit(1);
}
const sql = neon(url);

type Listed = {
  id: string;
  name: string;
  role: string;
  bio: string;
  district: string | null;
  /** A company id (slug) in the directory, or null. */
  company: string | null;
  places: { place: string; role: string }[];
  email: string | null;
  sources: string[];
};

const { people } = JSON.parse(
  readFileSync(new URL("./research/people.json", import.meta.url), "utf8"),
) as { people: Listed[] };

/** The same stable hue the app derives for a signed-in user. */
const hueOf = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};

console.log(`loading → ${new URL(url).host}`);

for (const p of people) {
  await sql`
    insert into people (id, name, hue, role, company_id, district_id, bio, listed)
    values (${p.id}, ${p.name}, ${hueOf(p.id)}, ${p.role}, ${p.company},
            ${p.district}, ${p.bio}, true)
    on conflict (id) do update set
      name = excluded.name,
      role = excluded.role,
      company_id = excluded.company_id,
      district_id = excluded.district_id,
      bio = excluded.bio
    where people.user_id is null
  `;
  if (p.email)
    await sql`
      insert into person_emails (person_id, email) values (${p.id}, ${p.email.toLowerCase()})
      on conflict (person_id) do update set email = excluded.email
    `;
  for (const link of p.places)
    await sql`
      insert into place_people (place_id, person_id, role)
      values (${link.place}, ${p.id}, ${link.role})
      on conflict (place_id, person_id) do update set role = excluded.role
    `;
  console.log(
    `  ${p.name.padEnd(20)} ${p.places.length} places${p.email ? " · email on file" : ""}`,
  );
}
