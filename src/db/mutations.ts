import type { Discipline, Employment, Level, Workplace } from "../domain";
import type { DistrictId } from "../map/spokane";
import { db } from "./client";

/**
 * Every write the product makes.
 *
 * Each one sends the minimum a policy in `db/schema.sql` will accept and
 * nothing more. In particular none of them sends `status`: a submission is
 * `pending` because the column defaults to it and the policy's `with check`
 * refuses anything else, not because this file was polite about it. Sending it
 * from here would be writing the rule down in the one place an attacker gets
 * to edit.
 *
 * `submitted_by` / `posted_by` / `user_id` are sent, because the policies
 * compare them to `auth.user_id()` — a row claiming the wrong owner is
 * rejected by Postgres rather than quietly accepted.
 */

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

export type NewCompany = {
  name: string;
  tagline: string;
  about: string;
  hue: number;
  industryId: string;
  headcount: number;
  founded: number;
  stage: string;
  workplace: Workplace;
  district: DistrictId;
  address: string;
  zip: string;
  lng: number;
  lat: number;
  website: string;
  email: string;
  phone: string;
};

export async function addCompany(input: NewCompany, viewerId: string) {
  /* The id is the slug plus a short suffix. A slug alone collides the first
     time two people add a company with the same name, and a bare uuid makes
     every URL in the product unreadable. */
  const id = `${slugify(input.name)}-${Math.random().toString(36).slice(2, 6)}`;

  const { error } = await db()
    .from("companies")
    .insert({
      id,
      name: input.name,
      tagline: input.tagline,
      about: input.about,
      hue: input.hue,
      industry_id: input.industryId,
      headcount: input.headcount,
      founded: input.founded,
      stage: input.stage,
      workplace: input.workplace,
      district_id: input.district,
      address: input.address,
      zip: input.zip,
      lng: input.lng,
      lat: input.lat,
      website: input.website || null,
      email: input.email || null,
      phone: input.phone || null,
      submitted_by: viewerId,
    });
  if (error) throw error;

  return id;
}

export type NewJob = {
  companyId: string;
  title: string;
  discipline: Discipline;
  level: Level;
  employment: Employment;
  workplace: Workplace;
  payLow: number;
  payHigh: number;
  hourly: boolean;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  applyUrl: string;
};

export async function postJob(input: NewJob, viewerId: string) {
  const { error } = await db()
    .from("jobs")
    .insert({
      company_id: input.companyId,
      title: input.title,
      discipline: input.discipline,
      level: input.level,
      employment: input.employment,
      workplace: input.workplace,
      pay_low: input.payLow,
      pay_high: input.payHigh,
      hourly: input.hourly,
      summary: input.summary,
      responsibilities: input.responsibilities,
      requirements: input.requirements,
      apply_url: input.applyUrl || null,
      posted_by: viewerId,
    });
  if (error) throw error;
}

export type ProfileInput = {
  name: string;
  role: string;
  hue: number;
  companyId: string | null;
  district: DistrictId;
  openTo: boolean;
  skills: string[];
  bio: string;
  years: number;
  listed: boolean;
};

/**
 * Create or update the viewer's own row in the People tab.
 *
 * `on_conflict=user_id` with `resolution=merge-duplicates` makes this one
 * request rather than a read followed by a branch — which would race with
 * itself if somebody saved the form twice quickly, and leave two rows where
 * the unique constraint allows one.
 */
export async function saveProfile(input: ProfileInput, viewerId: string) {
  const { error } = await db()
    .from("people")
    .upsert(
      {
        id: `u-${viewerId}`,
        user_id: viewerId,
        name: input.name,
        role: input.role,
        hue: input.hue,
        company_id: input.companyId,
        district_id: input.district,
        open_to: input.openTo,
        skills: input.skills,
        bio: input.bio,
        years: input.years,
        listed: input.listed,
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

/** Take yourself out of the directory. Not a support ticket. */
export async function deleteProfile(viewerId: string) {
  const { error } = await db().from("people").delete().eq("user_id", viewerId);
  if (error) throw error;
}

/**
 * Ask to own a listing.
 *
 * This inserts a request; it does not set `claimed_by`. No RLS policy lets a
 * user write that column at all, which is the point — the whole value of a
 * claim is that a person checked it, and a claim you can grant yourself is
 * just a checkbox.
 */
export async function requestClaim(
  companyId: string,
  workEmail: string,
  note: string,
  viewerId: string,
) {
  const { error } = await db().from("claims").insert({
    company_id: companyId,
    user_id: viewerId,
    work_email: workEmail,
    note,
  });
  if (error) throw error;
}

export async function saveJob(jobId: string, viewerId: string) {
  const { error } = await db()
    .from("saved_jobs")
    .upsert(
      { user_id: viewerId, job_id: jobId },
      { onConflict: "user_id,job_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function unsaveJob(jobId: string, viewerId: string) {
  const { error } = await db()
    .from("saved_jobs")
    .delete()
    .eq("user_id", viewerId)
    .eq("job_id", jobId);
  if (error) throw error;
}

export async function listSavedJobIds(viewerId: string): Promise<string[]> {
  const { data, error } = await db()
    .from("saved_jobs")
    .select("job_id")
    .eq("user_id", viewerId);
  if (error) throw error;
  return (data ?? []).map((r: { job_id: string }) => r.job_id);
}

/**
 * The company ids this viewer has already asked to claim.
 *
 * `claims_read_own` is the only policy on the table that returns anything, so
 * this is every claim they can see — which is exactly the set the button needs
 * in order to stop offering. A claim under review is not a rejection, and
 * asking twice is the thing a person does when the first ask left no trace.
 */
export async function listMyClaims(viewerId: string): Promise<string[]> {
  const { data, error } = await db()
    .from("claims")
    .select("company_id")
    .eq("user_id", viewerId);
  if (error) throw error;
  return (data ?? []).map((r: { company_id: string }) => r.company_id);
}

/** The industries table, for the Add Company select. Cached for the session. */
let industriesCache: { id: string; name: string }[] | null = null;

export async function listIndustries() {
  if (industriesCache) return industriesCache;
  const { data, error } = await db()
    .from("industries")
    .select("id,name")
    .order("sort");
  if (error) throw error;
  industriesCache = (data ?? []) as { id: string; name: string }[];
  return industriesCache;
}
