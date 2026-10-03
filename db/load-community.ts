/**
 * Loads the Community tab from the research files.
 *
 *   bun run db:community
 *
 * Two files, the same rules as the company research — every row sourced, a
 * field nobody published is null:
 *
 * - `research/coffee-shops.json`: where people work from and meet.
 * - `research/community.json`: coworking spaces, organisations and meetups.
 *
 * Idempotent by upsert. A place dropped from the files is not deleted here;
 * closing a place is a decision, not a side effect of a re-run.
 */
import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { DISTRICTS } from "../src/map/spokane";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  process.exit(1);
}
const sql = neon(url);

type Researched = {
  name: string;
  kind?: "coffee" | "coworking" | "organization" | "meetup";
  website: string | null;
  address: string | null;
  zip: string | null;
  district: string;
  lng: number | null;
  lat: number | null;
  why: string | null;
  schedule?: string | null;
  venue?: string | null;
  sources: string[];
};

const read = (name: string): Researched[] => {
  const path = new URL(`./research/${name}`, import.meta.url);
  if (!existsSync(path)) return [];
  return (JSON.parse(readFileSync(path, "utf8")) as { places: Researched[] })
    .places;
};

const places = [
  ...read("coffee-shops.json").map((p) => ({ ...p, kind: "coffee" as const })),
  ...read("community.json"),
];

const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const centre = Object.fromEntries(DISTRICTS.map((d) => [d.id, d.at] as const));

/* A meetup with no address of its own meets somewhere — and if that venue is
   one of the places, it sits on that pin. Otherwise, and for anything else
   without an address, the district's centre: the same fallback the company
   loader and the add-company form use. */
const byName = new Map(places.map((p) => [p.name.toLowerCase(), p]));
const locate = (p: Researched) => {
  if (p.lng != null && p.lat != null) return { lng: p.lng, lat: p.lat };
  const venue = p.venue && byName.get(p.venue.toLowerCase());
  if (venue && venue.lng != null && venue.lat != null)
    return { lng: venue.lng, lat: venue.lat };
  const at = centre[p.district];
  if (!at) throw new Error(`Unknown district ${p.district} for ${p.name}`);
  return at;
};

console.log(`loading → ${new URL(url).host}`);

for (const p of places) {
  if (!p.kind) throw new Error(`No kind for ${p.name}`);
  const at = locate(p);
  await sql`
    insert into places (
      id, name, kind, why, schedule, venue, website, address, zip,
      district_id, lng, lat, sources, status
    ) values (
      ${slug(p.name)}, ${p.name}, ${p.kind}::place_kind, ${p.why ?? ""},
      ${p.schedule ?? null}, ${p.venue ?? null}, ${p.website}, ${p.address ?? ""},
      ${p.zip ?? ""}, ${p.district}, ${at.lng}, ${at.lat}, ${p.sources},
      'published'
    )
    on conflict (id) do update set
      name = excluded.name,
      kind = excluded.kind,
      why = excluded.why,
      schedule = excluded.schedule,
      venue = excluded.venue,
      website = excluded.website,
      address = excluded.address,
      zip = excluded.zip,
      district_id = excluded.district_id,
      lng = excluded.lng,
      lat = excluded.lat,
      sources = excluded.sources
  `;
}

const counts = places.reduce<Record<string, number>>((n, p) => {
  n[p.kind!] = (n[p.kind!] ?? 0) + 1;
  return n;
}, {});
console.log(`  places  ${places.length}`, counts);
