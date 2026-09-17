/**
 * The domain: what a company, a job and a person are, and every rule that can
 * be worked out from one without asking the database.
 *
 * This file holds no rows. It was the app's entire dataset when this was a
 * prototype; the rows now live in Postgres and arrive through
 * `db/directory.tsx`, and what stayed behind is the part that was never really
 * data — the vocabularies the filters are built from, and the derivations that
 * must give the same answer everywhere they are asked.
 *
 * Keeping them here rather than beside the queries is deliberate. `sizeBand`
 * and `payRange` are the reason two screens cannot disagree about what "11–50"
 * or "$145k–$178k" means, and that guarantee is worth more than the
 * convenience of computing either one in a SQL view.
 */

import type { DistrictId } from "./map/spokane";

export type Industry =
  | "Health tech"
  | "Aerospace"
  | "Advanced manufacturing"
  | "Cybersecurity"
  | "Fintech"
  | "Agtech"
  | "Cleantech"
  | "Games"
  | "Developer tools"
  | "Logistics"
  | "Education"
  | "Data & analytics"
  | "Robotics"
  | "E-commerce"
  | "Design studio"
  | "Business software"
  | "IT services";

export type Stage =
  | "Bootstrapped"
  | "Seed"
  | "Series A"
  | "Series B"
  | "Employee-owned"
  | "Private";

export type Workplace = "On-site" | "Hybrid" | "Remote-first";

export type SizeBand = "1–10" | "11–50" | "51–200" | "201–500" | "500+";

export type Company = {
  id: string;
  name: string;
  /** The monogram tile's hue. One number, so the mark cannot drift from the name. */
  hue: number;
  tagline: string;
  about: string;
  industry: Industry;
  /** Null where the fact is not public — see the schema. */
  headcount: number | null;
  founded: number | null;
  stage: Stage | null;
  workplace: Workplace | null;
  district: DistrictId;
  address: string;
  zip: string;
  lng: number;
  lat: number;
  website: string;
  email: string;
  phone: string;
  /** Whether anyone from the company has claimed the listing. */
  claimed: boolean;
  /** Who claimed it, when the reader is allowed to know. */
  claimedBy?: string | null;
};

/**
 * Size is derived, never stored. The comps printed "11–50 Employees" under
 * every company including a 1–10; a band that disagrees with the headcount
 * beside it is worse than no band.
 */
export function sizeBand(headcount: number): SizeBand;
export function sizeBand(headcount: number | null): SizeBand | null;
export function sizeBand(headcount: number | null): SizeBand | null {
  if (headcount === null) return null;
  if (headcount <= 10) return "1–10";
  if (headcount <= 50) return "11–50";
  if (headcount <= 200) return "51–200";
  if (headcount <= 500) return "201–500";
  return "500+";
}

export const SIZE_BANDS: SizeBand[] = [
  "1–10",
  "11–50",
  "51–200",
  "201–500",
  "500+",
];

export type Discipline =
  | "Engineering"
  | "Design"
  | "Data"
  | "Product"
  | "Operations"
  | "Sales"
  | "Support";

export type Level = "Junior" | "Mid" | "Senior" | "Staff" | "Lead";

export type Employment = "Full-time" | "Contract" | "Internship" | "Apprentice";

export type Job = {
  id: string;
  companyId: string;
  title: string;
  discipline: Discipline;
  level: Level;
  employment: Employment;
  workplace: Workplace;
  /** Annual, in dollars. Contract and apprentice roles quote hourly — see `hourly`. */
  payLow: number;
  payHigh: number;
  hourly?: boolean;
  /**
   * Days since the listing went up. Derived from `postedAt` on the way in —
   * the interface reads a count and the database stores an instant, and the
   * conversion happens once rather than in every component that formats it.
   */
  posted: number;
  postedAt?: string;
  applyUrl?: string | null;
  summary: string;
  responsibilities: string[];
  requirements: string[];
};

export type Person = {
  id: string;
  /** Set once a real account claims this row. Null for a seeded person. */
  userId?: string | null;
  name: string;
  hue: number;
  role: string;
  /** Where they work now. `null` is between things, which is a real state. */
  companyId: string | null;
  district: DistrictId;
  /** Looking, or listed but not looking. The comps had no such distinction. */
  openTo: boolean;
  skills: string[];
  bio: string;
  years: number;
};


/* ---- vocabularies -------------------------------------------------------
 *
 * The closed sets the filters are built from. These mirror the Postgres enums
 * in db/schema.sql: the database is what enforces them, and these are what the
 * interface offers. A value added in one and not the other shows up as a
 * filter that matches nothing, which is the failure mode you want over a row
 * that cannot be written.
 */

export const INDUSTRIES: Industry[] = [
  "Advanced manufacturing",
  "Aerospace",
  "Agtech",
  "Cleantech",
  "Cybersecurity",
  "Data & analytics",
  "Design studio",
  "Developer tools",
  "E-commerce",
  "Education",
  "Fintech",
  "Games",
  "Health tech",
  "Logistics",
  "Robotics",
  /* Added when the directory moved to sourced companies: the largest
     employers here are a metering manufacturer, two IT consultancies and a
     compliance-software company, and forcing those into "Developer tools" to
     fit the prototype's fifteen categories would mislabel them. */
  "Business software",
  "IT services",
];

export const STAGES: Stage[] = [
  "Bootstrapped",
  "Seed",
  "Series A",
  "Series B",
  "Employee-owned",
  "Private",
];

export const WORKPLACES: Workplace[] = ["On-site", "Hybrid", "Remote-first"];

export const DISCIPLINES: Discipline[] = [
  "Data",
  "Design",
  "Engineering",
  "Operations",
  "Product",
  "Sales",
  "Support",
];

export const EMPLOYMENTS: Employment[] = [
  "Full-time",
  "Contract",
  "Internship",
  "Apprentice",
];

export const LEVELS: Level[] = ["Junior", "Mid", "Senior", "Staff", "Lead"];

export { districtName as districtLabel } from "./map/spokane";

/* ---- formatting ---------------------------------------------------------
 *
 * Beside the types rather than in a component, because two screens showing the
 * same salary in two formats is how a job board loses trust.
 */

export function payRange(job: Job): string {
  if (job.hourly)
    return job.payLow === job.payHigh
      ? `$${job.payLow}/hr`
      : `$${job.payLow}–$${job.payHigh}/hr`;
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  return `${k(job.payLow)}–${k(job.payHigh)}`;
}

export function postedLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 31) return `${Math.round(days / 7)} weeks ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "A month ago" : `${months} months ago`;
}

/** Whole days between a timestamp and now, which is what `postedLabel` reads. */
export const daysSince = (at: string | Date) =>
  Math.max(
    0,
    Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000),
  );

/** Initials for a monogram tile. Two letters, and never more. */
export function initials(name: string): string {
  const words = name.split(/[\s&]+/).filter((w) => /[A-Za-z]/.test(w));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * A hue for a name, for a monogram tile that has no stored colour — a company
 * somebody just typed into the Add form, before it has an id. Stable for the
 * same name, so the preview does not change colour as you finish the word.
 */
export function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}
