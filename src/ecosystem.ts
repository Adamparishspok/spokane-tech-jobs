/**
 * The ecosystem around the directory: who built it, and what came before.
 *
 * Two editorial records rather than two more tables. A community figure did
 * not sign up and a shut-down company cannot claim its listing, so neither has
 * the write path that put companies, jobs and people in Postgres. They are
 * researched, sourced and reviewed in a diff like the research files in
 * `db/research`, and they ship with the app — which also means the History and
 * Community tabs work on a build with no database at all.
 */

import community from "./data/community.json";
import history from "./data/history.json";
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
  /** The year it was acquired or closed. */
  year: number;
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

export const FIGURES = community.people as Figure[];

/** Newest first: the graveyard reads as a timeline. */
export const PAST = (history.companies as PastCompany[])
  .slice()
  .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));

const figureIndex = new Map(FIGURES.map((f) => [f.id, f]));
const pastIndex = new Map(PAST.map((p) => [p.id, p]));

export const figure = (id: string) => figureIndex.get(id) ?? null;
export const pastCompany = (id: string) => pastIndex.get(id) ?? null;

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

/** "2010–2020", or just "2020" when nobody published the founding year. */
export const lifespan = (p: PastCompany) =>
  p.founded ? `${p.founded}–${p.year}` : `${p.year}`;

/** A source URL as its site's name, for a list a person can scan. */
export const sourceLabel = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
