import { cn } from "@kit/lib/cn";
import { Button } from "@kit/ui";
import { Building2, MapPin, MapPinOff, Plus, Users } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  districtLabel,
  payRange,
  postedLabel,
  sizeBand,
  type Company,
  type Job,
  type Person,
} from "../domain";
import { useDirectory } from "../db/directory";
import { Monogram } from "../design/brand";
import { FirstDay, NoResults, Panel, PanelHeader, Tag } from "./chrome";
import { EMPTY_QUERY, FilterBar, SearchField, type Query } from "./filters";

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

export type Tab = "companies" | "jobs" | "people";

const TAB_COPY: Record<Tab, { title: string; noun: string; search: string }> = {
  companies: {
    title: "Companies",
    noun: "company",
    search: "Search companies, industries…",
  },
  jobs: { title: "Jobs", noun: "role", search: "Search roles, companies…" },
  people: { title: "People", noun: "person", search: "Search people, skills…" },
};

export function BrowsePanel({
  tab,
  query,
  onQuery,
  companies,
  jobs,
  people,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onAdd,
  companyOf,
  firstDay,
}: {
  tab: Tab;
  query: Query;
  onQuery: (q: Query) => void;
  companies: Company[];
  jobs: Job[];
  people: Person[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onAdd: () => void;
  companyOf: (id: string) => Company;
  /** No data at all, rather than a filter that matched nothing. */
  firstDay: boolean;
}) {
  const { jobsAt } = useDirectory();
  const copy = TAB_COPY[tab];
  const count =
    tab === "companies"
      ? companies.length
      : tab === "jobs"
        ? jobs.length
        : people.length;

  const empty = count === 0;

  /* A person between roles has no company and therefore no place, so the
     People tab can legitimately show more rows than the map shows marks. That
     is a mismatch a person will notice and distrust, so it is stated rather
     than left to be discovered — and the people it concerns are exactly the
     ones most likely to be looking. */
  const offMap =
    tab === "people" ? people.filter((p) => !p.companyId).length : 0;

  return (
    <Panel className="pointer-events-auto w-[23rem] shrink-0">
      <PanelHeader
        title={copy.title}
        count={count}
        noun={copy.noun}
        actions={
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
        {!firstDay && <FilterBar tab={tab} query={query} onQuery={onQuery} />}

        {offMap > 0 && (
          <p className="mt-2.5 flex items-start gap-1.5 text-[0.75rem] leading-relaxed text-ink-4">
            <MapPinOff className="mt-px size-3.5 shrink-0" />
            <span>
              <span className="num">{offMap}</span> of these{" "}
              {offMap === 1 ? "is" : "are"} between roles, so{" "}
              {offMap === 1 ? "it has" : "they have"} no pin on the map.
            </span>
          </p>
        )}
      </PanelHeader>

      {empty ? (
        firstDay ? (
          <FirstDay tab={tab} onAdd={onAdd} />
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
          </ul>
          <div
            className="list-fade pointer-events-none absolute inset-x-0 bottom-0 h-8"
            aria-hidden
          />
        </div>
      )}
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
      <Monogram name={company.name} hue={company.hue} />
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
          <span aria-hidden>·</span>
          <span className="num">{sizeBand(company.headcount)}</span>
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
      <Monogram name={company.name} hue={company.hue} />
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
