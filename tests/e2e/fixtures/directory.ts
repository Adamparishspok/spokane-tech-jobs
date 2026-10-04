/**
 * A small, fixed directory for the tests: rows in the exact shape the Data
 * API returns, so the app runs its real code against them.
 *
 * Fixed rather than live because a screenshot test is only worth having if
 * the pixels change when the interface changes and not when somebody adds a
 * coffee shop. The live database gets its own smoke test (live.spec.ts).
 */
const company = (o: Record<string, unknown>) => ({
  hue: 150,
  about: "",
  headcount: null,
  founded: null,
  stage: null,
  workplace: null,
  zip: "99201",
  email: null,
  phone: null,
  logo_url: null,
  claimed_by: null,
  claimed_at: null,
  status: "published",
  submitted_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...o,
});

export const COMPANIES = [
  company({
    id: "itron",
    name: "Itron",
    tagline: "Utility and city resource measurement",
    industry_id: "cleantech",
    industries: { name: "Cleantech" },
    headcount: 5635,
    founded: 1977,
    district_id: "liberty-lake",
    address: "2111 N Molter Rd",
    zip: "99019",
    lng: -117.091377,
    lat: 47.675171,
    website: "itron.com",
  }),
  company({
    id: "14four",
    name: "14Four",
    tagline: "Brand, web and digital product studio",
    industry_id: "marketing-and-design",
    industries: { name: "Marketing & design" },
    district_id: "east-central",
    address: "1722 E Sprague Ave Ste 130",
    lng: -117.3856,
    lat: 47.6565,
    website: "14four.com",
  }),
  company({
    id: "kochava",
    name: "Kochava",
    tagline: "Mobile measurement and data marketplace",
    industry_id: "data-and-analytics",
    industries: { name: "Data & analytics" },
    district_id: "sandpoint",
    address: "",
    zip: "",
    lng: -116.5533,
    lat: 48.2766,
    website: "kochava.com",
  }),
];

export const JOBS = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    company_id: "itron",
    title: "Senior Firmware Engineer",
    discipline: "Engineering",
    level: "Senior",
    employment: "Full-time",
    workplace: "Hybrid",
    pay_low: 140000,
    pay_high: 175000,
    hourly: false,
    summary: "Firmware for the next generation of grid-edge meters.",
    responsibilities: ["Own the metering firmware roadmap"],
    requirements: ["Embedded C", "RTOS experience"],
    apply_url: null,
    posted_at: "2026-09-25T00:00:00Z",
    expires_at: "2026-12-24T00:00:00Z",
    posted_by: null,
    status: "published",
  },
];

export const PEOPLE = [
  {
    id: "riley-unclaimed",
    user_id: null,
    name: "Riley Unclaimed",
    hue: 210,
    role: "Founder, Example Co",
    company_id: null,
    district_id: "coeur-dalene",
    open_to: false,
    skills: [],
    bio: "Listed from public sources and not yet claimed.",
    years: 0,
    listed: true,
  },
  {
    id: "test-person",
    user_id: "u-1",
    name: "Avery Tester",
    hue: 30,
    role: "Software Engineer",
    company_id: "itron",
    district_id: "logan",
    open_to: true,
    skills: ["TypeScript", "Go"],
    bio: "Builds things for the grid.",
    years: 6,
    listed: true,
  },
];

export const PLACES = [
  {
    id: "indaba-coffee-broadway",
    name: "Indaba Coffee (Broadway)",
    kind: "coffee",
    why: "Hosts the Spokane Python User Group's Coffee & Code every first Monday.",
    schedule: null,
    venue: null,
    website: "indabacoffee.com",
    address: "1425 W Broadway Ave",
    zip: "99201",
    district_id: "kendall-yards",
    lng: -117.4337,
    lat: 47.6626,
    sources: ["https://www.meetup.com/python-spokane/"],
    status: "published",
  },
  {
    id: "dc509",
    name: "DC509",
    kind: "meetup",
    why: "Spokane's DEF CON group for hacking and secure coding.",
    schedule: "Fourth Thursday monthly",
    venue: "Wonder Building",
    website: null,
    address: "835 N Post St",
    zip: "99201",
    district_id: "kendall-yards",
    lng: -117.4247,
    lat: 47.6643,
    sources: ["https://www.meetup.com/dc-509/"],
    status: "published",
  },
];

export const PLACE_PEOPLE = [
  { place_id: "indaba-coffee-broadway", person_id: "riley-unclaimed", role: "Regular" },
];

export const INDUSTRIES = [
  { id: "cleantech", name: "Cleantech" },
  { id: "marketing-and-design", name: "Marketing & design" },
  { id: "data-and-analytics", name: "Data & analytics" },
];
