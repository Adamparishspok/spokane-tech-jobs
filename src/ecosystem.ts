/**
 * The ecosystem around the directory: who built it, and what came before.
 *
 * Editorial records rather than more tables. A community figure did not sign
 * up, a shut-down company cannot claim its listing, and an angel group or a
 * meetup is not an employer, so none of them has the write path that put
 * companies, jobs and people in Postgres. They are
 * researched, sourced and reviewed in a diff like the research files in
 * `db/research`, and they ship with the app — which also means the History and
 * Community tabs, and the figures on the People tab, work on a build with no
 * database at all.
 */

import community from "./data/community.json";
import history from "./data/history.json";
import organisations from "./data/organisations.json";
import type { LngLat } from "./map/projection";
import { DISTRICTS, type DistrictId } from "./map/spokane";

export type Figure = {
  id: string;
  name: string;
  /** The one-line headline under the name. */
  role: string;
  summary: string;
  /** Roles held, most recent first. */
  roles: string[];
  /** Directory companies this person is part of now. */
  companies: string[];
  /** History entries this person founded or led. */
  history: string[];
  links: { label: string; url: string }[];
  sources: string[];
  /** A caveat about the sourcing, said out loud rather than buried. */
  note?: string;
};

/** Acquired, or shut down. The two halves of the History tab. */
export type PastKind = "exited" | "closed";

export type PastCompany = {
  id: string;
  name: string;
  kind: PastKind;
  what: string;
  founded: number | null;
  /** The year it was acquired or closed — null when nobody published it. */
  year: number | null;
  outcome: string;
  acquirer?: string;
  /** Where it was, in words. Always present, even without a street address. */
  place: string;
  /** The area it was in — where its pin goes when no street was sourced. */
  district: DistrictId;
  /** Only where a street address was sourced. */
  lng?: number;
  lat?: number;
  /** The directory company it lives on as, where there is one. */
  successor?: string;
  people: string[];
  sources: string[];
};

/** What an organisation is to the scene. Also the Community tab's filter. */
export type OrgKind =
  "Investor" | "Accelerator" | "Coworking" | "Group" | "Event" | "Space";

export const ORG_KINDS: OrgKind[] = [
  "Investor",
  "Accelerator",
  "Coworking",
  "Group",
  "Event",
  "Space",
];

export type Org = {
  id: string;
  name: string;
  kind: OrgKind;
  what: string;
  website: string | null;
  /** A street address, where the organisation has a place of its own. */
  address: string | null;
  city: string | null;
  /** Only where a street address was sourced — a meetup has no pin. */
  lng?: number;
  lat?: number;
  /** When it meets or runs, in the organiser's own terms. */
  cadence: string | null;
  /** For an investor: the stage and sector it says it backs. */
  focus: string | null;
  /**
   * People who lead it, as "Name (role)" — linked by name when they are on
   * the People tab.
   */
  people: string[];
  /** The most recent dated sign that it is still running. */
  lastActive: string | null;
  sources: string[];
};

export const FIGURES = community.people as Figure[];

export const ORGS = (organisations.organisations as Org[])
  .slice()
  .sort(
    (a, b) =>
      ORG_KINDS.indexOf(a.kind) - ORG_KINDS.indexOf(b.kind) ||
      a.name.localeCompare(b.name),
  );

/** Newest first: the graveyard reads as a timeline. */
export const PAST = (history.companies as PastCompany[])
  .slice()
  /* An end nobody dated sorts by its founding, so it lands among its peers
     rather than at either end of the timeline. */
  .sort(
    (a, b) =>
      (b.year ?? b.founded ?? 0) - (a.year ?? a.founded ?? 0) ||
      a.name.localeCompare(b.name),
  );

const figureIndex = new Map(FIGURES.map((f) => [f.id, f]));
const pastIndex = new Map(PAST.map((p) => [p.id, p]));
const orgIndex = new Map(ORGS.map((o) => [o.id, o]));
const figureByName = new Map(FIGURES.map((f) => [f.name, f]));

export const figure = (id: string) => figureIndex.get(id) ?? null;
export const pastCompany = (id: string) => pastIndex.get(id) ?? null;
export const org = (id: string) => orgIndex.get(id) ?? null;

/** The People-tab entry for a name on an organisation, where there is one. */
export const figureNamed = (name: string) => figureByName.get(name) ?? null;

/** "Tom Simpson (CEO)" → { name: "Tom Simpson", role: "CEO" }. */
export const splitPerson = (entry: string) => {
  const m = entry.match(/^(.*?)\s*\((.*)\)$/);
  return m ? { name: m[1], role: m[2] } : { name: entry, role: null };
};

/** The organisations a figure leads. */
export const orgsOf = (f: Figure) =>
  ORGS.filter((o) => o.people.some((p) => splitPerson(p).name === f.name));

export const orgPlace = (o: Org): LngLat | null =>
  o.lng !== undefined && o.lat !== undefined
    ? { lng: o.lng, lat: o.lat }
    : null;

const districtAt = new Map(DISTRICTS.map((d) => [d.id, d.at]));

/** Whether a pin stands on a sourced street address or only on its area. */
export const isExact = (p: PastCompany) =>
  p.lng !== undefined && p.lat !== undefined;

/**
 * Where the pin goes. Most of the graveyard predates anybody writing down a
 * street address, so a company with only a city gets its area's centre — a
 * classification, like a live company's district, and labelled as such
 * wherever it is shown.
 */
export const placeOf = (p: PastCompany): LngLat =>
  isExact(p)
    ? { lng: p.lng!, lat: p.lat! }
    : (districtAt.get(p.district) ?? { lng: -117.42503, lat: 47.659017 });

export const PAST_KIND_LABEL: Record<PastKind, string> = {
  exited: "Acquired",
  closed: "Shut down",
};

/**
 * "2010–2020"; just "2020" when nobody published the founding year; "2014–?"
 * when nobody published the end.
 */
export const lifespan = (p: PastCompany) =>
  p.founded ? `${p.founded}–${p.year ?? "?"}` : `${p.year ?? "?"}`;

/** A source URL as its site's name, for a list a person can scan. */
export const sourceLabel = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
