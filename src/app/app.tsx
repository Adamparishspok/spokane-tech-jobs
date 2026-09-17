import { PortalHost } from "@kit/lib/portal-host";
import { ThemeProvider, useTheme } from "@kit/lib/theme";
import { TooltipProvider } from "@kit/ui";
import { Briefcase, Building2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Company, type Job, type Person } from "../domain";
import { signOut, useViewer } from "../db/auth";
import { useDirectory, type Directory } from "../db/directory";
import { Specimen } from "../design/specimen";
import { MapView, type Padding, type Pin } from "../map/map-view";
import { fit, viewportBounds, type Camera } from "../map/projection";
import { HOME } from "../map/spokane";
import { AuthDialog, Unreachable } from "./auth";
import { BrowsePanel, EcosystemStrip, type Tab } from "./browse";
import { Rail, Shell, type RailItem } from "./chrome";
import { CompanyDetail, DetailPanel, JobDetail, PersonDetail } from "./detail";
import { AddCompany, EditProfile, PostJob } from "./forms";
import {
  EMPTY_QUERY,
  filterCompanies,
  filterJobs,
  filterPeople,
  type Query,
} from "./filters";

/**
 * Spokane Tech Jobs.
 *
 * One screen. The rail picks what the directory is showing, the panel filters
 * it, the map draws it, and the detail column reads it — and all four are
 * projections of the same two pieces of state: the `Query` and the `Selection`.
 * That is the redesign in one sentence. The comps had a list and a map that
 * knew nothing about each other, which is why eleven results could sit beside
 * two pins without anything looking wrong.
 *
 * Routes, for anyone reading or shooting this:
 *
 * | `#specimen` | every token and primitive on one page   |
 *
 * The rows come from Postgres through `useDirectory`. That was the one change
 * this file needed when the prototype became an application: the fixture
 * imports became a hook, and every screen below carried on unmodified, because
 * none of them ever knew where a `Company[]` came from.
 */

const NAV: RailItem[] = [
  { id: "companies", label: "Companies", icon: <Building2 /> },
  { id: "jobs", label: "Jobs", icon: <Briefcase /> },
  { id: "people", label: "People", icon: <Users /> },
];

/** What the detail column is showing. */
type Selection =
  | { kind: "company"; id: string }
  | { kind: "job"; id: string }
  | { kind: "person"; id: string }
  | null;

/* The panels' footprint, so `fit` and the map controls stay clear of them.
   Panel widths are 23rem and 25rem plus the gutters they sit in. */
const PANEL_PAD: Padding = { left: 384, right: 24, top: 24, bottom: 24 };
const PANEL_PAD_DETAIL: Padding = { ...PANEL_PAD, right: 424 };

export function App() {
  return (
    <ThemeProvider storageKey="spokane-tech-jobs-theme">
      <Root />
    </ThemeProvider>
  );
}

function Root() {
  const { resolved } = useTheme();

  const [route] = useState(() =>
    location.hash === "#specimen" ? "specimen" : "app",
  );

  const viewer = useViewer();
  const directory = useDirectory();
  const { company: findCompany, isHiring, jobsAt, loading, error } = directory;

  /* The first day is now a state the database can actually be in rather than a
     hash somebody types: a fresh branch with the schema applied and the seed
     not run has no companies, and every empty state below is what that looks
     like. */
  const empty = !loading && directory.companies.length === 0;

  const [authOpen, setAuthOpen] = useState(false);

  const [tab, setTab] = useState<Tab>("companies");
  const [query, setQuery] = useState<Query>(EMPTY_QUERY);
  const [selection, setSelection] = useState<Selection>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [camera, setCamera] = useState<Camera>(HOME);
  const [form, setForm] = useState<"company" | "job" | "profile" | null>(null);

  /* Every write in this product needs a session, so the gate lives in one
     place: asking for a form while signed out opens sign-in instead, and the
     form is not rendered at all. Guarding inside each form would have meant
     three chances to forget. */
  const openForm = (which: "company" | "job" | "profile") => {
    if (!viewer) {
      setAuthOpen(true);
      return;
    }
    setForm(which);
  };

  /* The map's real box, reported by `MapView` once it has measured itself.
     Seeded with something plausible so the first `fit` before layout is not
     nonsense; every one after it is measured. */
  const mapSize = useRef({ width: 1000, height: 900 });

  /* `[]` written inline would be a new array every render, which would make
     every filter below re-run on every keystroke elsewhere in the app. */
  const { companies, jobs, people } = directory;

  /* The detail column and the rows want a company, not a maybe-company. A
     missing id here means a job whose company was filtered out from under it,
     which the callers already treat as "nothing to show". */
  const companyOf = useCallback(
    (id: string) => findCompany(id) as Company,
    [findCompany],
  );

  /* ---- the query, resolved --------------------------------------------- */

  const shownCompanies = useMemo(
    () => filterCompanies(companies, query, isHiring),
    [companies, query, isHiring],
  );
  const shownJobs = useMemo(
    () => filterJobs(jobs, query, companyOf),
    [jobs, query, companyOf],
  );
  const shownPeople = useMemo(
    () => filterPeople(people, query, (id) => companyOf(id) ?? null),
    [people, query, companyOf],
  );

  /**
   * Pins.
   *
   * All three tabs resolve to company locations, because that is where the
   * places are — a job is at a company and a person works at one. What changes
   * between tabs is what the mark counts: matching roles on the Jobs tab,
   * matching people on People, open roles on Companies. A pin that always said
   * the same thing would be decoration.
   */
  const pins: Pin[] = useMemo(() => {
    if (tab === "companies") {
      return shownCompanies.map((c) => ({
        id: c.id,
        at: { lng: c.lng, lat: c.lat },
        label: c.name,
        count: jobsAt(c.id).length,
        unit: "open role",
        hiring: jobsAt(c.id).length > 0,
      }));
    }

    if (tab === "jobs") {
      const byCompany = new Map<string, number>();
      for (const job of shownJobs)
        byCompany.set(job.companyId, (byCompany.get(job.companyId) ?? 0) + 1);
      return [...byCompany].map(([id, count]) => {
        const c = companyOf(id);
        return {
          id: c.id,
          at: { lng: c.lng, lat: c.lat },
          label: c.name,
          count,
          unit: "matching role",
          hiring: true,
        };
      });
    }

    const byCompany = new Map<string, number>();
    for (const person of shownPeople)
      if (person.companyId)
        byCompany.set(
          person.companyId,
          (byCompany.get(person.companyId) ?? 0) + 1,
        );
    return [...byCompany].map(([id, count]) => {
      const c = companyOf(id);
      return {
        id: c.id,
        at: { lng: c.lng, lat: c.lat },
        label: c.name,
        count,
        unit: "person",
        /* On the People tab an orange mark would mean "hiring", which is not
           what it counts. Every mark here is the quiet one. */
        hiring: false,
      };
    });
  }, [tab, shownCompanies, shownJobs, shownPeople, companyOf]);

  /**
   * What the map and the list agree is highlighted.
   *
   * A job row and a person row both point at a company pin, so the id the map
   * knows is not always the id the list knows. Resolving it here is what keeps
   * the two in sync without either of them knowing about the other.
   */
  const selectedCompanyId =
    selection?.kind === "company"
      ? selection.id
      : selection?.kind === "job"
        ? (jobs.find((j) => j.id === selection.id)?.companyId ?? null)
        : selection?.kind === "person"
          ? (people.find((p) => p.id === selection.id)?.companyId ?? null)
          : null;

  const hoveredCompanyId = useMemo(() => {
    if (!hovered) return null;
    if (findCompany(hovered)) return hovered;
    const job = jobs.find((j) => j.id === hovered);
    if (job) return job.companyId;
    const person = people.find((p) => p.id === hovered);
    return person?.companyId ?? null;
  }, [hovered, findCompany, jobs, people]);

  /* ---- selection ------------------------------------------------------- */

  const select = (id: string) => {
    if (tab === "jobs") {
      const job = jobs.find((j) => j.id === id);
      if (job) return setSelection({ kind: "job", id });
      /* A click came from the map, where a Jobs-tab pin is still a company.
         Open the company; its Jobs tab is what somebody wanted. */
      return setSelection({ kind: "company", id });
    }
    if (tab === "people") {
      const person = people.find((p) => p.id === id);
      if (person) return setSelection({ kind: "person", id });
      return setSelection({ kind: "company", id });
    }
    setSelection({ kind: "company", id });
  };

  /**
   * Opening the detail column moves the map rather than covering it.
   *
   * This is the fix for the comps' drawer, which slid over the right third of
   * the map — reliably including the pin that had just been clicked. Here the
   * camera eases so the selected pin lands in the gap between the two panels.
   */
  useEffect(() => {
    if (!selectedCompanyId) return;
    const c = findCompany(selectedCompanyId);
    if (!c) return;
    /* A single point has no extent, so `fit` would take it to the top of the
       zoom range and land on a street corner. What is wanted is the
       neighbourhood: close enough to see where the company is, far enough to
       see what it is near. Pinning both limits to one value turns `fit` into
       "recentre, with the panels accounted for", which is the whole job. */
    const zoom = Math.min(Math.max(camera.zoom, 13.4), 14.4);
    const next = fit(
      [{ lng: c.lng, lat: c.lat }],
      mapSize.current,
      PANEL_PAD_DETAIL,
      [zoom, zoom],
    );
    if (next) setCamera(next);
    // Only when the selected company changes — not when the camera does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  /* Changing tab keeps the query but drops a selection that no longer has a
     row to sit next to. */
  const changeTab = (next: Tab) => {
    setTab(next);
    setSelection(null);
    setHovered(null);
  };

  const searchArea = () =>
    setQuery((q) => ({ ...q, area: viewportBounds(camera, mapSize.current) }));

  /* Escape closes the detail column, which is the only thing on this screen
     that can be closed without hitting a target. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selection) setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection]);

  if (route === "specimen") {
    return (
      <div data-proto="spokane" data-theme={resolved} className="min-h-dvh">
        <Specimen />
      </div>
    );
  }

  /* A directory that cannot be reached is not an empty directory, and saying
     "no companies match these filters" when the truth is "the database did not
     answer" is the worst thing this screen could do. */
  if (error && companies.length === 0) {
    return (
      <div data-proto="spokane" data-theme={resolved}>
        <Unreachable message={error} onRetry={directory.refresh} />
      </div>
    );
  }

  const selected = resolve(selection, directory);

  return (
    <div data-proto="spokane" data-theme={resolved}>
      <TooltipProvider delayDuration={250}>
        <PortalHost>
          <Shell>
            <Rail
              items={NAV}
              active={tab}
              onNavigate={(id) => changeTab(id as Tab)}
              onAccount={() => setForm("profile")}
              viewer={viewer}
              onSignIn={() => setAuthOpen(true)}
              onSignOut={async () => {
                await signOut();
                directory.refresh();
              }}
            />

            {/* The map is the page. The panels sit on it in a padded grid
                rather than beside it, which is what keeps the city visible
                between them — the comps' panel was flush to the window edge
                and the map started underneath it. */}
            <div className="relative min-w-0 flex-1">
              <MapView
                className="absolute inset-0"
                pins={pins}
                camera={camera}
                onCamera={(next) => {
                  setCamera(next);
                  /* Once the map has moved by hand, a viewport filter that is
                     still armed is describing somewhere else. */
                  if (query.area) setQuery((q) => ({ ...q, area: null }));
                }}
                selectedId={selectedCompanyId}
                hoveredId={hoveredCompanyId}
                onSelect={select}
                onHover={setHovered}
                padding={selection ? PANEL_PAD_DETAIL : PANEL_PAD}
                theme={resolved}
                onSearchArea={searchArea}
                areaSearched={query.area !== null}
                /* The strip sits in the same top-centre slot; 44px of pill
                   plus a 12px gap puts "Search this area" under it. */
                topInset={empty ? 0 : 56}
                onSize={(size) => (mapSize.current = size)}
              />

              <div className="pointer-events-none absolute inset-0 flex gap-4 p-4">
                <BrowsePanel
                  tab={tab}
                  query={query}
                  onQuery={setQuery}
                  companies={shownCompanies}
                  jobs={shownJobs}
                  people={shownPeople}
                  selectedId={
                    selection?.kind === "company"
                      ? selection.id
                      : (selection?.id ?? null)
                  }
                  hoveredId={hovered ?? hoveredCompanyId}
                  onSelect={select}
                  onHover={setHovered}
                  onAdd={() =>
                    openForm(
                      /* Posting a job needs a company to hang it on, so on the
                         first day the Jobs tab's action is still Add company —
                         same button, same destination as its empty state. */
                      tab === "jobs" && !empty
                        ? "job"
                        : tab === "people"
                          ? "profile"
                          : "company",
                    )
                  }
                  companyOf={companyOf}
                  firstDay={empty}
                />

                <div className="flex flex-1 flex-col items-center">
                  {!empty && (
                    <EcosystemStrip
                      companies={companies}
                      jobs={jobs}
                      onTab={changeTab}
                    />
                  )}
                </div>

                {selected && (
                  <DetailPanel
                    onClose={() => setSelection(null)}
                    onBack={
                      selected.kind !== "company" && selectedCompanyId
                        ? () =>
                            setSelection({
                              kind: "company",
                              id: selectedCompanyId,
                            })
                        : undefined
                    }
                  >
                    {selected.kind === "company" && (
                      <CompanyDetail
                        company={selected.company}
                        onSignIn={() => setAuthOpen(true)}
                        onJob={(job: Job) =>
                          setSelection({ kind: "job", id: job.id })
                        }
                        onPerson={(person: Person) =>
                          setSelection({ kind: "person", id: person.id })
                        }
                      />
                    )}
                    {selected.kind === "job" && (
                      <JobDetail
                        job={selected.job}
                        company={selected.company}
                        onSignIn={() => setAuthOpen(true)}
                        onCompany={(c: Company) =>
                          setSelection({ kind: "company", id: c.id })
                        }
                      />
                    )}
                    {selected.kind === "person" && (
                      <PersonDetail
                        person={selected.person}
                        company={selected.company}
                        onCompany={(c: Company) =>
                          setSelection({ kind: "company", id: c.id })
                        }
                      />
                    )}
                  </DetailPanel>
                )}
              </div>
            </div>
          </Shell>

          <AddCompany
            open={form === "company"}
            onOpenChange={(open) => setForm(open ? "company" : null)}
          />
          <PostJob
            open={form === "job"}
            onOpenChange={(open) => setForm(open ? "job" : null)}
          />
          <EditProfile
            open={form === "profile"}
            onOpenChange={(open) => setForm(open ? "profile" : null)}
          />
          <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
        </PortalHost>
      </TooltipProvider>
    </div>
  );
}

/**
 * Turn a selection into the records the detail column needs, or nothing.
 *
 * "Or nothing" is load-bearing now in a way it was not against a fixture: a
 * selected row can genuinely disappear between renders — a listing expires, a
 * refresh drops it — and the column has to close rather than throw.
 */
function resolve(selection: Selection, d: Directory) {
  if (!selection) return null;

  if (selection.kind === "company") {
    const company = d.company(selection.id);
    return company ? ({ kind: "company", company } as const) : null;
  }

  if (selection.kind === "job") {
    const job = d.jobs.find((j) => j.id === selection.id);
    const company = job && d.company(job.companyId);
    if (!job || !company) return null;
    return { kind: "job", job, company } as const;
  }

  const person = d.people.find((p) => p.id === selection.id);
  if (!person) return null;
  return {
    kind: "person",
    person,
    company: person.companyId ? d.company(person.companyId) : null,
  } as const;
}
