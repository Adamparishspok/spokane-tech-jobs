import { cn } from "@kit/lib/cn";
import { Button, Segmented } from "@kit/ui";
import { Building2, MapPin, MapPinOff, Plus, Users } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  districtLabel,
  hueFor,
  payRange,
  postedLabel,
  sizeBand,
  type Company,
  type Job,
  type Person,
} from "../domain";
import { useDirectory } from "../db/directory";
import {
  lifespan,
  pastCompany,
  PAST_KIND_LABEL,
  isExact,
  ORG_KINDS,
  orgPlace,
  type Figure,
  type Org,
  type PastCompany,
} from "../ecosystem";
import { Monogram, logoFor, orgLogoFor } from "../design/brand";
import { FirstDay, NoResults, Panel, PanelHeader, Tag } from "./chrome";
import {
  EMPTY_QUERY,
  FilterBar,
  MultiFilter,
  SearchField,
  type Query,
} from "./filters";

/**
 * The browse panel — the left column, and half of the "one query, two views"
 * idea the redesign turns on.
 *
 * Every row here is paired with a mark on the map. Hovering the row lights the
 * mark; hovering the mark lights the row and scrolls it into view. Neither
 * direction is decoration: in a city this size the question is nearly always
 * "what is near me", and a list that cannot be pointed at on a map is just a
 * list.
 */

export type Tab = "companies" | "jobs" | "people" | "community" | "history";

/** The two tabs read from the editorial records rather than the database. */
export const isEditorial = (tab: Tab) =>
  tab === "community" || tab === "history";

const TAB_COPY: Record<Tab, { title: string; noun: string; search: string }> = {
  companies: {
    title: "Companies",
    noun: "company",
    search: "Search companies, industries…",
  },
  jobs: { title: "Jobs", noun: "role", search: "Search roles, companies…" },
  people: { title: "People", noun: "person", search: "Search people, skills…" },
  community: {
    title: "Community",
    noun: "organisation",
    search: "Search investors, groups, spaces…",
  },
  history: {
    title: "History",
    noun: "company",
    search: "Search exits, closures, acquirers…",
  },
};

export function BrowsePanel({
  tab,
  query,
  onQuery,
  companies,
  jobs,
  people,
  figures,
  orgs,
  past,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onAdd,
  companyOf,
  firstDay: noData,
  loading,
  variant = "panel",
}: {
  tab: Tab;
  query: Query;
  onQuery: (q: Query) => void;
  companies: Company[];
  jobs: Job[];
  people: Person[];
  figures: Figure[];
  orgs: Org[];
  past: PastCompany[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onAdd: () => void;
  companyOf: (id: string) => Company;
  /** No data at all, rather than a filter that matched nothing. */
  firstDay: boolean;
  /** The first load has not answered yet. */
  loading: boolean;
  /** A desktop panel, or the list alone inside a phone's bottom sheet. */
  variant?: "panel" | "sheet";
}) {
  const { jobsAt, company } = useDirectory();
  const copy = TAB_COPY[tab];
  const editorial = isEditorial(tab);
  /* The editorial tabs ship with the app, so an empty database is not a
     first day for them. */
  const firstDay = noData && !editorial;
  const count = {
    companies: companies.length,
    jobs: jobs.length,
    people: figures.length + people.length,
    community: orgs.length,
    history: past.length,
  }[tab];

  const empty = count === 0;

  /* A person between roles has no company and therefore no place, and nor
     does a community figure whose company is not in the directory — so the
     People tab can legitimately show more rows than the map shows marks. That
     is a mismatch a person will notice and distrust, so it is stated rather
     than left to be discovered — and the people it concerns are exactly the
     ones most likely to be looking. */
  const offMap =
    tab === "people"
      ? people.filter((p) => !p.companyId).length +
        figures.filter((f) => !f.companies.some((id) => company(id))).length
      : tab === "history"
        ? past.filter((p) => !isExact(p)).length
        : tab === "community"
          ? orgs.filter((o) => !orgPlace(o)).length
          : 0;

  /* The rows, the same on a desktop panel and a phone's sheet. On a phone
     the search and filters live in the top bar instead of this header. */
  const list = (
    <>
      {/* Loading is not empty. Before the first answer the list draws the
          shape of rows rather than "0 companies" and an empty state, which
          read as a broken directory for the second it took to arrive. */}
      {loading && !editorial ? (
        <RowsLoading />
      ) : empty ? (
        firstDay && !editorial ? (
          <FirstDay
            tab={tab as "companies" | "jobs" | "people"}
            onAdd={onAdd}
          />
        ) : (
          <NoResults noun={copy.noun} onClear={() => onQuery(EMPTY_QUERY)} />
        )
      ) : (
        /* The fade at the foot says "there is more" — a row sliced cleanly by
           the panel edge reads as the end of the list. */
        <div className="relative min-h-0 flex-1">
          <ul className="h-full divide-y divide-line overflow-y-auto">
            {tab === "companies" &&
              companies.map((c) => (
                <CompanyRow
                  key={c.id}
                  company={c}
                  openRoles={jobsAt(c.id).length}
                  selected={c.id === selectedId}
                  hovered={c.id === hoveredId}
                  onSelect={onSelect}
                  onHover={onHover}
                />
              ))}
            {tab === "jobs" &&
              jobs.map((j) => (
                <JobRow
                  key={j.id}
                  job={j}
                  company={companyOf(j.companyId)}
                  selected={j.id === selectedId}
                  hovered={j.companyId === hoveredId || j.id === hoveredId}
                  onSelect={onSelect}
                  onHover={onHover}
                />
              ))}
            {tab === "people" &&
              figures.map((f) => (
                <FigureRow
                  key={f.id}
                  figure={f}
                  selected={f.id === selectedId}
                  hovered={
                    f.id === hoveredId ||
                    (hoveredId !== null && f.companies.includes(hoveredId))
                  }
                  onSelect={onSelect}
                  onHover={onHover}
                />
              ))}
            {tab === "people" &&
              people.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  company={p.companyId ? companyOf(p.companyId) : null}
                  selected={p.id === selectedId}
                  hovered={p.id === hoveredId}
                  onSelect={onSelect}
                  onHover={onHover}
                />
              ))}
            {tab === "community" &&
              orgs.map((o) => (
                <OrgRow
                  key={o.id}
                  org={o}
                  selected={o.id === selectedId}
                  hovered={o.id === hoveredId}
                  onSelect={onSelect}
                  onHover={onHover}
                />
              ))}
            {tab === "history" &&
              past.map((p) => (
                <PastRow
                  key={p.id}
                  past={p}
                  selected={p.id === selectedId}
                  hovered={p.id === hoveredId}
                  onSelect={onSelect}
                  onHover={onHover}
                />
              ))}
          </ul>
          <div
            className="list-fade pointer-events-none absolute inset-x-0 bottom-0 h-8"
            aria-hidden
          />
        </div>
      )}
    </>
  );

  if (variant === "sheet")
    return <div className="flex min-h-0 flex-1 flex-col">{list}</div>;

  return (
    <Panel className="pointer-events-auto w-[23rem] shrink-0">
      <PanelHeader
        title={copy.title}
        count={loading ? null : count}
        noun={copy.noun}
        actions={
          !editorial && (
            <Button size="sm" variant="accent" onClick={onAdd}>
              <Plus />
              {/* On the first day there is nothing to post a job against, so
                the header offers the same thing the empty state does rather
                than contradicting it. */}
              {firstDay && tab === "jobs"
                ? "Add"
                : tab === "jobs"
                  ? "Post a job"
                  : tab === "companies"
                    ? "Add"
                    : "Profile"}
            </Button>
          )
        }
      >
        <div className="mt-3">
          <SearchField
            value={query.text}
            onChange={(text) => onQuery({ ...query, text })}
            placeholder={copy.search}
          />
        </div>
        {/* Filters are hidden on the first day. Four pills that can only ever
            narrow nothing to nothing are not a control, they are furniture. */}
        {tab === "community" ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <MultiFilter
              label="Type"
              options={ORG_KINDS}
              value={query.orgKinds}
              onChange={(orgKinds) => onQuery({ ...query, orgKinds })}
            />
          </div>
        ) : tab === "history" ? (
          <div className="mt-3">
            <Segmented
              size="sm"
              className="w-full"
              aria-label="Exits or closures"
              value={query.pastKind}
              onChange={(pastKind) => onQuery({ ...query, pastKind })}
              items={[
                { value: "all", label: "All" },
                { value: "exited", label: "Exits" },
                { value: "closed", label: "Graveyard" },
              ]}
            />
          </div>
        ) : (
          !firstDay &&
          !editorial && <FilterBar tab={tab} query={query} onQuery={onQuery} />
        )}

        {offMap > 0 && (
          <p className="mt-2.5 flex items-start gap-1.5 text-[0.75rem] leading-relaxed text-ink-4">
            <MapPinOff className="mt-px size-3.5 shrink-0" />
            {tab === "community" ? (
              <span>
                <span className="num">{offMap}</span> of these{" "}
                {offMap === 1 ? "has" : "have"} no fixed address — a meetup, an
                event that moves, a fund — so{" "}
                {offMap === 1 ? "it has" : "they have"} no pin on the map.
              </span>
            ) : tab === "history" ? (
              <span>
                <span className="num">{offMap}</span> of these{" "}
                {offMap === 1 ? "has" : "have"} no sourced street address, so{" "}
                {offMap === 1 ? "its pin marks" : "their pins mark"} the area,
                not the building.
              </span>
            ) : (
              <span>
                <span className="num">{offMap}</span> of these{" "}
                {offMap === 1 ? "is" : "are"} not at a company in the directory,
                so {offMap === 1 ? "it has" : "they have"} no pin on the map.
              </span>
            )}
          </p>
        )}
      </PanelHeader>
      {list}
    </Panel>
  );
}

/**
 * The row shell.
 *
 * `scrollIntoView` on hover is the part that is easy to get wrong: it must
 * only fire when the hover came from the map, or moving the mouse down the
 * list makes the list move under the mouse. The map sets `hovered` while the
 * pointer is nowhere near the panel, so the guard is simply whether this row
 * already has the pointer.
 */
function Row({
  id,
  selected,
  hovered,
  onSelect,
  onHover,
  label,
  children,
}: {
  id: string;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  label: string;
  children: React.ReactNode;
}) {
  const el = useRef<HTMLLIElement>(null);
  const pointerHere = useRef(false);

  useEffect(() => {
    if (!hovered || pointerHere.current) return;
    el.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [hovered]);

  return (
    <li
      ref={el}
      onMouseEnter={() => {
        pointerHere.current = true;
        onHover(id);
      }}
      onMouseLeave={() => {
        pointerHere.current = false;
        onHover(null);
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(id)}
        aria-label={label}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex w-full gap-3 px-4 py-3 text-left transition-colors",
          selected
            ? "bg-brand-faint"
            : hovered
              ? "bg-surface-2"
              : "hover:bg-surface-2",
        )}
      >
        {children}
      </button>
    </li>
  );
}

function CompanyRow({
  company,
  openRoles,
  ...rest
}: {
  company: Company;
  openRoles: number;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const open = openRoles;

  return (
    <Row id={company.id} label={company.name} {...rest}>
      <Monogram
        name={company.name}
        hue={company.hue}
        logo={company.logo ?? logoFor(company.id)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="truncate text-sm font-semibold text-ink">
            {company.name}
          </h3>
          {open > 0 && (
            <span className="num ml-auto shrink-0 text-[0.75rem] font-semibold text-hiring">
              {open} open
            </span>
          )}
        </div>
        <p className="truncate text-[0.8125rem] text-ink-3">
          {company.tagline}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[0.75rem] text-ink-4">
          <MapPin className="size-3" />
          {districtLabel(company.district)}
          {sizeBand(company.headcount) !== null && (
            <>
              <span aria-hidden>·</span>
              <span className="num">{sizeBand(company.headcount)}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span className="truncate">{company.industry}</span>
        </p>
      </div>
    </Row>
  );
}

function JobRow({
  job,
  company,
  ...rest
}: {
  job: Job;
  company: Company;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <Row id={job.id} label={`${job.title} at ${company.name}`} {...rest}>
      <Monogram
        name={company.name}
        hue={company.hue}
        logo={company.logo ?? logoFor(company.id)}
      />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm leading-snug font-semibold text-ink">
          {job.title}
        </h3>
        <p className="truncate text-[0.8125rem] text-ink-3">
          {company.name}
          <span aria-hidden> · </span>
          {districtLabel(company.district)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {/* Pay is on the row, not behind a click. A job board that makes you
              open a listing to find out is wasting everybody's afternoon. */}
          <Tag tone="brand">{payRange(job)}</Tag>
          <Tag>{job.workplace}</Tag>
          {job.employment !== "Full-time" && <Tag>{job.employment}</Tag>}
          <span className="num ml-auto text-[0.75rem] text-ink-4">
            {postedLabel(job.posted)}
          </span>
        </div>
      </div>
    </Row>
  );
}

function PersonRow({
  person,
  company,
  ...rest
}: {
  person: Person;
  company: Company | null;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <Row id={person.id} label={person.name} {...rest}>
      <Monogram name={person.name} hue={person.hue} round />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="truncate text-sm font-semibold text-ink">
            {person.name}
          </h3>
          {person.openTo && (
            <span className="ml-auto shrink-0">
              <Tag tone="hiring">Open</Tag>
            </span>
          )}
        </div>
        <p className="truncate text-[0.8125rem] text-ink-3">
          {person.role}
          {company && (
            <>
              <span aria-hidden> · </span>
              {company.name}
            </>
          )}
        </p>
        <p className="mt-1 truncate text-[0.75rem] text-ink-4">
          {person.skills.slice(0, 3).join(" · ")}
        </p>
      </div>
    </Row>
  );
}

function FigureRow({
  figure,
  ...rest
}: {
  figure: Figure;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  /* What they built, by name — the reason anybody in this list is in it. */
  const built = figure.history
    .map((id) => pastCompany(id)?.name)
    .filter(Boolean);

  return (
    <Row id={figure.id} label={figure.name} {...rest}>
      <Monogram name={figure.name} hue={hueFor(figure.name)} round />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-ink">
          {figure.name}
        </h3>
        <p className="truncate text-[0.8125rem] text-ink-3">{figure.role}</p>
        {built.length > 0 && (
          <p className="mt-1 truncate text-[0.75rem] text-ink-4">
            Built {built.join(" · ")}
          </p>
        )}
      </div>
    </Row>
  );
}

function OrgRow({
  org,
  ...rest
}: {
  org: Org;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  /* The second line says when or where, whichever a person would act on:
     a meetup's night, a space's neighbourhood, a fund's stage. */
  const detail = org.cadence ?? org.focus ?? org.city;
  return (
    <Row id={org.id} label={org.name} {...rest}>
      <Monogram
        name={org.name}
        hue={hueFor(org.name)}
        logo={orgLogoFor(org.id)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="truncate text-sm font-semibold text-ink">
            {org.name}
          </h3>
          <span className="ml-auto shrink-0">
            <Tag>{org.kind}</Tag>
          </span>
        </div>
        <p className="truncate text-[0.8125rem] text-ink-3">{org.what}</p>
        {detail && (
          <p className="mt-1 truncate text-[0.75rem] text-ink-4">{detail}</p>
        )}
      </div>
    </Row>
  );
}

function PastRow({
  past,
  ...rest
}: {
  past: PastCompany;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <Row id={past.id} label={past.name} {...rest}>
      {/* Desaturated: the mark of something that is no longer trading, in
          the same tile every live company gets. */}
      <Monogram
        name={past.name}
        hue={hueFor(past.name)}
        className="grayscale"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="truncate text-sm font-semibold text-ink">
            {past.name}
          </h3>
          <span className="ml-auto shrink-0">
            <Tag tone={past.kind === "exited" ? "brand" : "neutral"}>
              {PAST_KIND_LABEL[past.kind]}
            </Tag>
          </span>
        </div>
        <p className="truncate text-[0.8125rem] text-ink-3">{past.what}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[0.75rem] text-ink-4">
          <span className="num">{lifespan(past)}</span>
          <span aria-hidden>·</span>
          <span className="truncate">
            {past.acquirer ? `to ${past.acquirer}` : past.place}
          </span>
        </p>
      </div>
    </Row>
  );
}

/** Two summary numbers above the map, so the region has a shape at a glance. */
export function EcosystemStrip({
  companies,
  jobs,
  onTab,
}: {
  companies: Company[];
  jobs: Job[];
  onTab: (tab: Tab) => void;
}) {
  /* Both numbers are the length of a list that is already on screen, so they
     cannot disagree with it — which is the whole point of deriving rather than
     storing a count. */
  const roles = jobs.length;

  return (
    <div className="glass pointer-events-auto flex items-center gap-1 rounded-full border px-1 py-1">
      <StripStat
        icon={<Building2 />}
        value={companies.length}
        label="companies"
        onClick={() => onTab("companies")}
      />
      <span className="h-5 w-px bg-line" />
      <StripStat
        icon={<Users />}
        value={roles}
        label="open roles"
        tone="hiring"
        onClick={() => onTab("jobs")}
      />
    </div>
  );
}

function StripStat({
  icon,
  value,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone?: "hiring";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] transition-colors hover:bg-surface-2"
    >
      <span
        className={cn(
          "[&_svg]:size-3.5",
          tone === "hiring" ? "text-hiring" : "text-ink-4",
        )}
      >
        {icon}
      </span>
      <span className="num font-semibold text-ink">{value}</span>
      <span className="text-ink-3">{label}</span>
    </button>
  );
}

/** Placeholder rows for the first load: the list's shape, without content. */
function RowsLoading() {
  return (
    <ul
      className="min-h-0 flex-1 divide-y divide-line overflow-hidden"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: 7 }, (_, i) => (
        <li key={i} className="flex gap-3 px-4 py-3">
          <span className="size-10 shrink-0 animate-pulse motion-reduce:animate-none rounded-card bg-surface-3" />
          <span className="grid flex-1 content-start gap-2 pt-1">
            <span
              className="h-3 animate-pulse motion-reduce:animate-none rounded bg-surface-3"
              style={{ width: `${55 + ((i * 17) % 35)}%` }}
            />
            <span className="h-2.5 w-[85%] animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
            <span className="h-2.5 w-[40%] animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
          </span>
        </li>
      ))}
    </ul>
  );
}
