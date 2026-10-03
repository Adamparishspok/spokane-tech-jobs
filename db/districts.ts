/**
 * Writes the district list from src/map/spokane.ts to the database.
 *
 *   bun run db:districts
 *
 * Its own script because the seed also restores the prototype's invented
 * companies, which the sourced directory has since replaced: adding a town
 * should not bring them back. Idempotent by upsert.
 */
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { DISTRICTS } from "../src/map/spokane";

export async function upsertDistricts(sql: NeonQueryFunction<false, false>) {
  for (const [i, d] of DISTRICTS.entries()) {
    await sql`
      insert into districts (id, name, lng, lat, min_zoom, sort, city, state, area)
      values (${d.id}, ${d.name}, ${d.at.lng}, ${d.at.lat}, ${d.minZoom}, ${i},
              ${d.city}, ${d.state}, ${d.area})
      on conflict (id) do update set
        name = excluded.name,
        lng = excluded.lng,
        lat = excluded.lat,
        min_zoom = excluded.min_zoom,
        sort = excluded.sort,
        city = excluded.city,
        state = excluded.state,
        area = excluded.area
    `;
  }
  console.log(`  districts  ${DISTRICTS.length}`);
}

if (import.meta.main) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local.");
    process.exit(1);
  }
  await upsertDistricts(neon(url));
}
