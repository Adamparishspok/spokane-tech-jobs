/**
 * Loads sourced job listings from db/research/real-jobs.json.
 *
 *   bun run db:load-jobs
 *
 * Every row in the research file is a posting that was actually seen on the
 * company's own board or ATS feed, and carries the URL it was taken from. The
 * title, pay range and posted date are the posting's own. Three fields are
 * classification rather than fact — `discipline`, `level` and `workplace` are
 * the posting mapped onto this board's closed vocabularies — and the research
 * file says so in its own header.
 *
 * Expiry is ninety days from the load, not from the original posted date. A
 * role posted months ago and still open on the company's board today is a
 * live listing, and dating its expiry from the original posting would land it
 * here already dead. Re-running the loader is a re-verification, so it
 * restarts the ninety days; a listing dropped from the research file simply
 * runs its clock out. Where the employer published a closing date and it comes
 * sooner, that wins — a listing should not outlive the posting it points at.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  process.exit(1);
}
const sql = neon(url);

type ResearchedJob = {
  id: string;
  company: string;
  title: string;
  discipline: string;
  level: string;
  employment: string;
  workplace: string;
  pay_low: number;
  pay_high: number;
  hourly: boolean;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  apply_url: string;
  posted_at: string | null;
  closes_at: string | null;
  sources: string[];
};

const file = JSON.parse(
  readFileSync(new URL("./research/real-jobs.json", import.meta.url), "utf8"),
) as { jobs: ResearchedJob[] };

/**
 * The same slug → UUID derivation db/seed.ts uses, so the load is idempotent:
 * the same research row always lands on the same database row.
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
  return `${a}-${b.slice(0, 4)}-4${b.slice(4, 7)}-8${c.slice(0, 3)}-${c.slice(3)}${a.slice(0, 4)}`;
}

console.log(`loading jobs → ${new URL(url).host}`);

const companies = new Set(
  ((await sql`select id from companies`) as { id: string }[]).map((r) => r.id),
);

const ninetyDays = Date.now() + 90 * 24 * 60 * 60 * 1000;

let loaded = 0;
for (const j of file.jobs) {
  if (!companies.has(j.company)) {
    // A job against a company the directory does not hold is a research-file
    // mistake, and loading it would violate the foreign key anyway. Say which.
    throw new Error(
      `Job ${j.id}: no company '${j.company}' in the directory — run db:load-real first?`,
    );
  }
  const postedAt = j.posted_at ?? new Date().toISOString();
  const expiresAt = new Date(
    Math.min(ninetyDays, j.closes_at ? Date.parse(j.closes_at) : Infinity),
  ).toISOString();
  if (Date.parse(expiresAt) <= Date.now()) {
    console.log(`  skip  ${j.id} — closed ${j.closes_at}`);
    continue;
  }
  await sql`
    insert into jobs (
      id, company_id, title, discipline, level, employment, workplace,
      pay_low, pay_high, hourly, summary, responsibilities, requirements,
      apply_url, status, posted_at, expires_at
    ) values (
      ${uuidFor(j.id)}, ${j.company}, ${j.title}, ${j.discipline}::discipline,
      ${j.level}::seniority, ${j.employment}::employment,
      ${j.workplace}::workplace, ${j.pay_low}, ${j.pay_high}, ${j.hourly},
      ${j.summary}, ${j.responsibilities}, ${j.requirements},
      ${j.apply_url}, 'published', ${postedAt}, ${expiresAt}
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
      apply_url = excluded.apply_url,
      posted_at = excluded.posted_at,
      expires_at = excluded.expires_at
  `;
  loaded++;
}

console.log(
  `  jobs  ${loaded} sourced, expiring by ${new Date(ninetyDays).toISOString().slice(0, 10)}`,
);
console.log("ok");
