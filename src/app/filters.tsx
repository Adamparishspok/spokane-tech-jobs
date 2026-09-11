import { cn } from "@kit/lib/cn";
import { Popover, PopoverContent, PopoverTrigger, Separator } from "@kit/ui";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useMemo } from "react";
import {
  DISCIPLINES,
  INDUSTRIES,
  SIZE_BANDS,
  WORKPLACES,
  sizeBand,
  type Company,
  type Discipline,
  type Industry,
  type Job,
  type Person,
  type SizeBand,
  type Workplace,
} from "../domain";
import { within, type Bounds } from "../map/projection";

/**
 * Filtering, for all three tabs.
 *
 * The original comps had none — a search field that searched nothing, over a
 * list of eleven identical rows. For a directory this is the product: a
 * mid-size market has maybe six companies doing what you want, and the whole
 * job is getting from twenty-one to those six.
 *
 * One `Query` drives the list and the map together. That is the structural
 * decision of the redesign and the reason this type is shared rather than
 * duplicated per tab: two filter states would let the panel and the map
 * disagree about what the search is, which is precisely what the comps did.
 */

export type Query = {
  text: string;
  industries: Industry[];
  sizes: SizeBand[];
  workplaces: Workplace[];
  disciplines: Discipline[];
  hiringOnly: boolean;
  /** People only: listed *and* looking. */
  openToOnly: boolean;
  /**
   * The map viewport, when the person has asked for it. Null means the whole
   * region — panning the map does not silently drop results, it offers to.
   */
  area: Bounds | null;
};

export const EMPTY_QUERY: Query = {
  text: "",
  industries: [],
  sizes: [],
  workplaces: [],
  disciplines: [],
  hiringOnly: false,
  openToOnly: false,
  area: null,
};

export const isFiltered = (q: Query) =>
  q.text.trim() !== "" ||
  q.industries.length > 0 ||
  q.sizes.length > 0 ||
  q.workplaces.length > 0 ||
  q.disciplines.length > 0 ||
  q.hiringOnly ||
  q.openToOnly ||
  q.area !== null;

const match = (haystack: string[], text: string) => {
  const needle = text.trim().toLowerCase();
  if (!needle) return true;
  return haystack.some((h) => h.toLowerCase().includes(needle));
};

export function filterCompanies(
  companies: Company[],
  q: Query,
  hiring: (id: string) => boolean,
): Company[] {
  return companies.filter((c) => {
    if (q.hiringOnly && !hiring(c.id)) return false;
    if (q.industries.length && !q.industries.includes(c.industry)) return false;
    if (q.sizes.length && !q.sizes.includes(sizeBand(c.headcount)))
      return false;
    if (q.workplaces.length && !q.workplaces.includes(c.workplace))
      return false;
    if (q.area && !within(q.area, { lng: c.lng, lat: c.lat })) return false;
    return match([c.name, c.tagline, c.about, c.industry], q.text);
  });
}

export function filterJobs(
  jobs: Job[],
  q: Query,
  companyOf: (id: string) => Company,
): Job[] {
  return jobs.filter((j) => {
    const c = companyOf(j.companyId);
    if (q.disciplines.length && !q.disciplines.includes(j.discipline))
      return false;
    if (q.industries.length && !q.industries.includes(c.industry)) return false;
    if (q.sizes.length && !q.sizes.includes(sizeBand(c.headcount)))
      return false;
    if (q.workplaces.length && !q.workplaces.includes(j.workplace))
      return false;
    if (q.area && !within(q.area, { lng: c.lng, lat: c.lat })) return false;
    return match([j.title, j.summary, c.name, j.discipline, j.level], q.text);
  });
}

export function filterPeople(
  people: Person[],
  q: Query,
  companyOf: (id: string) => Company | null,
): Person[] {
  return people.filter((p) => {
    if (q.openToOnly && !p.openTo) return false;
    const c = p.companyId ? companyOf(p.companyId) : null;
    if (q.industries.length && (!c || !q.industries.includes(c.industry)))
      return false;
    /* A person not at a company has no size or workplace to filter on, and
       silently dropping them would hide exactly the people who are looking. */
    if (q.sizes.length && (!c || !q.sizes.includes(sizeBand(c.headcount))))
      return false;
    if (q.workplaces.length && (!c || !q.workplaces.includes(c.workplace)))
      return false;
    return match([p.name, p.role, p.bio, ...p.skills, c?.name ?? ""], q.text);
  });
}

/* ---- the bar ----------------------------------------------------------- */

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-field border border-line-2 bg-field pr-8 pl-8 text-sm text-ink transition-[border-color,box-shadow] outline-none placeholder:text-ink-4 focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-ink-4 hover:bg-surface-3 hover:text-ink-2"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * A multi-select filter.
 *
 * The kit's `FilterPill` is single-select, which is the wrong shape here:
 * "Health tech or Cleantech" is a normal thing to want from a directory and
 * a radio group cannot express it. The pill shows the first choice and a
 * count rather than a truncated list — a pill that reads "Health tech, Clean…"
 * is wider than the panel and says less.
 */
export function MultiFilter<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T[];
  onChange: (value: T[]) => void;
}) {
  const summary =
    value.length === 0
      ? label
      : value.length === 1
        ? value[0]
        : `${label} · ${value.length}`;

  const toggle = (option: T) =>
    onChange(
      value.includes(option)
        ? value.filter((v) => v !== option)
        : [...value, option],
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[0.8125rem] font-medium transition-colors",
            value.length
              ? "border-brand/35 bg-brand-faint text-brand-deep"
              : "border-line-2 bg-surface text-ink-2 hover:bg-surface-2",
          )}
        >
          {summary}
          <ChevronDown className="size-3.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="max-h-72 overflow-y-auto">
          {options.map((option) => (
            /* The row is the control — `role="checkbox"` on the button
               itself rather than a real <input> inside it. A Radix Checkbox
               here renders its own <button>, and a button inside a button is
               invalid HTML that browsers silently unnest, which takes the
               click handler with it. The box below is presentational. */
            <button
              key={option}
              type="button"
              role="checkbox"
              aria-checked={value.includes(option)}
              onClick={() => toggle(option)}
              className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-sm text-ink-2 hover:bg-surface-2"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-[0.25rem] border transition-colors",
                  value.includes(option)
                    ? "border-brand bg-brand text-brand-ink"
                    : "border-line-3 bg-surface",
                )}
              >
                {value.includes(option) && <Check className="size-3" />}
              </span>
              <span className="flex-1 truncate">{option}</span>
            </button>
          ))}
        </div>
        {value.length > 0 && (
          <>
            <Separator className="my-1" />
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full rounded-[6px] px-2 py-1.5 text-left text-[0.8125rem] text-ink-3 hover:bg-surface-2"
            >
              Clear {label.toLowerCase()}
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** A boolean filter that is its own pill — no menu for a single yes/no. */
export function TogglePill({
  label,
  active,
  onChange,
  tone = "brand",
}: {
  label: string;
  active: boolean;
  onChange: (active: boolean) => void;
  tone?: "brand" | "hiring";
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onChange(!active)}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[0.8125rem] font-medium transition-colors",
        !active && "border-line-2 bg-surface text-ink-2 hover:bg-surface-2",
        active &&
          tone === "hiring" &&
          "border-hiring/40 bg-hiring-soft text-hiring-2",
        active &&
          tone === "brand" &&
          "border-brand/35 bg-brand-faint text-brand-deep",
      )}
    >
      {active && <Check className="size-3.5" />}
      {label}
    </button>
  );
}

/**
 * The bar itself. Which pills appear depends on the tab, because a discipline
 * filter on a list of companies filters nothing and a headcount filter on a
 * list of people filters the wrong thing.
 */
export function FilterBar({
  tab,
  query,
  onQuery,
}: {
  tab: "companies" | "jobs" | "people";
  query: Query;
  onQuery: (next: Query) => void;
}) {
  const set = <K extends keyof Query>(key: K, value: Query[K]) =>
    onQuery({ ...query, [key]: value });

  const dirty = useMemo(() => isFiltered(query), [query]);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {tab === "jobs" && (
        <MultiFilter
          label="Discipline"
          options={DISCIPLINES}
          value={query.disciplines}
          onChange={(v) => set("disciplines", v)}
        />
      )}

      <MultiFilter
        label="Industry"
        options={INDUSTRIES}
        value={query.industries}
        onChange={(v) => set("industries", v)}
      />

      <MultiFilter
        label="Size"
        options={SIZE_BANDS}
        value={query.sizes}
        onChange={(v) => set("sizes", v)}
      />

      <MultiFilter
        label="Workplace"
        options={WORKPLACES}
        value={query.workplaces}
        onChange={(v) => set("workplaces", v)}
      />

      {tab === "companies" && (
        <TogglePill
          label="Hiring"
          tone="hiring"
          active={query.hiringOnly}
          onChange={(v) => set("hiringOnly", v)}
        />
      )}

      {tab === "people" && (
        <TogglePill
          label="Open to work"
          active={query.openToOnly}
          onChange={(v) => set("openToOnly", v)}
        />
      )}

      {/* The viewport filter is a pill like any other, so it can be seen and
          removed. A map that silently filters to what is on screen is the
          reason people think a directory is empty. */}
      {query.area && (
        <TogglePill
          label="This area"
          active
          onChange={() => set("area", null)}
        />
      )}

      {dirty && (
        <button
          type="button"
          onClick={() => onQuery({ ...EMPTY_QUERY, text: query.text })}
          className="ml-auto shrink-0 text-[0.8125rem] font-medium text-ink-3 underline-offset-2 hover:text-ink hover:underline"
        >
          Reset
        </button>
      )}
    </div>
  );
}
