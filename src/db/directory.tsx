import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  daysSince,
  type Company,
  type Discipline,
  type Employment,
  type Industry,
  type Job,
  type Level,
  type Person,
  type Stage,
  type Workplace,
} from "../domain";
import type { DistrictId } from "../map/spokane";
import { db, explain, hasBackend } from "./client";

/**
 * The directory, loaded once and shared.
 *
 * This is the seam where the prototype's fixture used to be. Every screen that
 * imported `COMPANIES` now calls `useDirectory()`, and the shape it gets back
 * is deliberately the same — `Company[]`, `Job[]`, `Person[]`, plus the four
 * lookups the interface actually uses. Nothing above this file knows the rows
 * came from Postgres, which is why swapping the source did not touch a single
 * screen's layout.
 *
 * It loads the whole directory in three requests and keeps it in memory. That
 * is the right call at this size and would be the wrong one at ten times it:
 * twenty-one companies and thirty-odd roles is perhaps 60KB of JSON, and
 * holding it means filtering and the map are instant and offline-ish, where
 * per-keystroke round trips to PostgREST would make the one interaction the
 * product is built on — hover a row, light a pin — feel like a network.
 *
 * The ceiling is real and worth naming: past a few thousand rows this becomes
 * a paginated query with the filters pushed into PostgREST, and the map gets a
 * bounding-box parameter. The shape of `useDirectory` does not have to change
 * for that; its implementation does.
 */

/* ---- wire shapes --------------------------------------------------------
 *
 * What PostgREST returns, which is snake_case and carries the columns the
 * domain types do not: ids of the reviewed-and-published sort, timestamps
 * rather than day counts. Mapped once, here, so the rest of the app keeps
 * working in the vocabulary it was written in.
 */

type CompanyRow = {
  id: string;
  name: string;
  tagline: string;
  about: string;
  hue: number;
  industry_id: string;
  logo_url: string | null;
  headcount: number | null;
  founded: number | null;
  stage: Stage | null;
  workplace: Workplace | null;
  district_id: DistrictId;
  address: string;
  zip: string;
  lng: number;
  lat: number;
  website: string | null;
  email: string | null;
  phone: string | null;
  claimed_by: string | null;
  industries: { name: Industry } | null;
};

type JobRow = {
  id: string;
  company_id: string;
  title: string;
  discipline: Discipline;
  level: Level;
  employment: Employment;
  workplace: Workplace;
  pay_low: number;
  pay_high: number;
  hourly: boolean;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  apply_url: string | null;
  posted_at: string;
};

type PersonRow = {
  id: string;
  user_id: string | null;
  name: string;
  hue: number;
  role: string;
  company_id: string | null;
  district_id: DistrictId | null;
  open_to: boolean;
  skills: string[];
  bio: string;
  years: number;
};

const toCompany = (row: CompanyRow): Company => ({
  id: row.id,
  name: row.name,
  hue: row.hue,
  tagline: row.tagline,
  about: row.about,
  /* The join is the display name; the foreign key is the slug. If the embed
     came back empty the row is still usable, so it falls back rather than
     dropping a company off the map over a label. */
  industry: (row.industries?.name ?? row.industry_id) as Industry,
  logo: row.logo_url,
  headcount: row.headcount,
  founded: row.founded,
  stage: row.stage,
  workplace: row.workplace,
  district: row.district_id,
  address: row.address,
  zip: row.zip,
  lng: row.lng,
  lat: row.lat,
  website: row.website ?? "",
  email: row.email ?? "",
  phone: row.phone ?? "",
  claimed: row.claimed_by !== null,
  claimedBy: row.claimed_by,
});

const toJob = (row: JobRow): Job => ({
  id: row.id,
  companyId: row.company_id,
  title: row.title,
  discipline: row.discipline,
  level: row.level,
  employment: row.employment,
  workplace: row.workplace,
  payLow: row.pay_low,
  payHigh: row.pay_high,
  hourly: row.hourly,
  /* The fixture stored "days ago" and the table stores a timestamp. The
     interface still wants the number, so the conversion happens once here
     rather than in the three places that format it. */
  posted: daysSince(row.posted_at),
  postedAt: row.posted_at,
  summary: row.summary,
  responsibilities: row.responsibilities,
  requirements: row.requirements,
  applyUrl: row.apply_url,
});

const toPerson = (row: PersonRow): Person => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  hue: row.hue,
  role: row.role,
  companyId: row.company_id,
  district: (row.district_id ?? "downtown") as DistrictId,
  openTo: row.open_to,
  skills: row.skills,
  bio: row.bio,
  years: row.years,
});

/* ---- the context -------------------------------------------------------- */

export type Directory = {
  companies: Company[];
  jobs: Job[];
  people: Person[];
  loading: boolean;
  /** Null when everything is fine, a sentence when it is not. */
  error: string | null;
  /** Re-fetch. Called after a write, so a submission shows up where it landed. */
  refresh: () => void;
  company: (id: string) => Company | null;
  jobsAt: (companyId: string) => Job[];
  peopleAt: (companyId: string) => Person[];
  isHiring: (companyId: string) => boolean;
};

const DirectoryCtx = createContext<Directory | null>(null);


export function DirectoryProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(hasBackend);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!hasBackend) {
      setError(
        "This build has no database configured. Copy .env.example to .env.local.",
      );
      setLoading(false);
      return;
    }

    let live = true;
    setLoading(true);

    (async () => {
      const client = db();
      /* One embed on companies, so the industry's display name arrives with
         the row rather than as twenty-one extra requests. `live_jobs` is the
         view that applies expiry, so a closed listing leaves the board without
         anybody having to sweep it. */
      const [c, j, p] = await Promise.all([
        client.from("companies").select("*,industries(name)").order("name"),
        client
          .from("live_jobs")
          .select("*")
          .order("posted_at", { ascending: false }),
        client
          .from("people")
          .select("*")
          .eq("listed", true)
          .order("open_to", { ascending: false })
          .order("name"),
      ]);

      if (!live) return;

      const failure = c.error ?? j.error ?? p.error;
      if (failure) {
        setError(explain(failure));
        setLoading(false);
        return;
      }

      setCompanies((c.data as CompanyRow[]).map(toCompany));
      setJobs((j.data as JobRow[]).map(toJob));
      setPeople((p.data as PersonRow[]).map(toPerson));
      setError(null);
      setLoading(false);
    })();

    return () => {
      live = false;
    };
  }, [nonce]);

  /* Indexed once per load rather than scanned per call. The job list is
     filtered on every keystroke and every hover, and `jobsAt` is called once
     per visible row inside that. */
  const byCompany = useMemo(() => {
    const jobsIndex = new Map<string, Job[]>();
    for (const job of jobs) {
      const list = jobsIndex.get(job.companyId);
      if (list) list.push(job);
      else jobsIndex.set(job.companyId, [job]);
    }
    const peopleIndex = new Map<string, Person[]>();
    for (const person of people) {
      if (!person.companyId) continue;
      const list = peopleIndex.get(person.companyId);
      if (list) list.push(person);
      else peopleIndex.set(person.companyId, [person]);
    }
    const companyIndex = new Map(companies.map((c) => [c.id, c]));
    return { jobsIndex, peopleIndex, companyIndex };
  }, [companies, jobs, people]);

  const value = useMemo<Directory>(
    () => ({
      companies,
      jobs,
      people,
      loading,
      error,
      refresh,
      company: (id) => byCompany.companyIndex.get(id) ?? null,
      jobsAt: (id) => byCompany.jobsIndex.get(id) ?? EMPTY_JOBS,
      peopleAt: (id) => byCompany.peopleIndex.get(id) ?? EMPTY_PEOPLE,
      isHiring: (id) => (byCompany.jobsIndex.get(id)?.length ?? 0) > 0,
    }),
    [companies, jobs, people, loading, error, refresh, byCompany],
  );

  return (
    <DirectoryCtx.Provider value={value}>{children}</DirectoryCtx.Provider>
  );
}

/* Shared empties, so a company with no jobs does not hand back a fresh array
   every render and invalidate every memo downstream of it. */
const EMPTY_JOBS: Job[] = [];
const EMPTY_PEOPLE: Person[] = [];

export function useDirectory(): Directory {
  const ctx = useContext(DirectoryCtx);
  if (!ctx)
    throw new Error("useDirectory must be used inside <DirectoryProvider>");
  return ctx;
}
