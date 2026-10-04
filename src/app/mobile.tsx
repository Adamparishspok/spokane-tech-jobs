import { cn } from "@kit/lib/cn";
import { useTheme } from "@kit/lib/theme";
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Segmented,
} from "@kit/ui";
import {
  ChevronLeft,
  List,
  Map as MapIcon,
  Menu as MenuIcon,
  Monitor,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  X,
} from "lucide-react";
import {
  animate,
  AnimatePresence,
  motion,
  useDragControls,
  useMotionValue,
  useTransform,
} from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import type { Viewer } from "../db/auth";
import { DISCIPLINES, INDUSTRIES, SIZE_BANDS, WORKPLACES } from "../domain";
import { ORG_KINDS } from "../ecosystem";
import type { RailItem } from "./chrome";
import { plural } from "./chrome";
import { EMPTY_QUERY, isFiltered, type Query } from "./filters";
import type { Tab } from "./browse";

/**
 * The phone layout, in the shape people already know from Airbnb: the map is
 * the page, the list is a sheet over it that can be pulled up or pushed down,
 * and one floating button flips between the two.
 *
 * Nothing here holds directory state. The query, the selection and the tab are
 * the same ones the desktop layout reads; this file only arranges them for a
 * thumb.
 */

/** Below this width the desktop's three columns do not fit. */
const MOBILE = "(max-width: 767px)";

export function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE).matches,
  );
  useEffect(() => {
    const q = window.matchMedia(MOBILE);
    const on = () => setMobile(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return mobile;
}

/** The top bar's height: search row plus section chips, and the notch. */
export const MOBILE_TOP = 116;

/* ---- top bar -------------------------------------------------------------- */

export function MobileTopBar({
  query,
  onQuery,
  placeholder,
  sections,
  tab,
  onTab,
  onFilters,
  showFilters,
  menu,
}: {
  query: Query;
  onQuery: (q: Query) => void;
  placeholder: string;
  sections: RailItem[];
  tab: Tab;
  onTab: (tab: Tab) => void;
  onFilters: () => void;
  showFilters: boolean;
  menu: ReactNode;
}) {
  const active = activeFilters(query);
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="pointer-events-auto flex items-center gap-2 px-3 pt-3">
        {/* 16px text: anything smaller and iOS zooms the page on focus. */}
        <label className="glass flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border px-4 shadow-[var(--shadow-card)]">
          <Search className="size-4 shrink-0 text-ink-3" />
          <input
            type="search"
            value={query.text}
            onChange={(e) => onQuery({ ...query, text: e.target.value })}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-4"
            aria-label="Search"
          />
          {query.text && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onQuery({ ...query, text: "" })}
              className="-mr-2 grid size-8 place-items-center rounded-full text-ink-4"
            >
              <X className="size-4" />
            </button>
          )}
        </label>
        {showFilters && (
          <button
            type="button"
            onClick={onFilters}
            aria-label={active ? `Filters, ${active} on` : "Filters"}
            className="glass relative grid size-12 shrink-0 place-items-center rounded-full border text-ink shadow-[var(--shadow-card)]"
          >
            <SlidersHorizontal className="size-[1.125rem]" />
            {active > 0 && (
              <span className="num absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-ink text-[0.6875rem] font-semibold text-ground">
                {active}
              </span>
            )}
          </button>
        )}
        {menu}
      </div>

      {/* The sections, as a row of chips the thumb can swipe — the rail's
          job on a desktop, and Airbnb's category bar on a phone. */}
      <nav
        aria-label="Sections"
        className="pointer-events-auto mt-2 flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onTab(s.id as Tab)}
            aria-current={s.id === tab ? "page" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium shadow-[var(--shadow-card)] transition-colors [&_svg]:size-4",
              s.id === tab
                ? "border-ink bg-ink text-ground"
                : "glass text-ink-2",
            )}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/** How many filters are on, for the badge. Text search is not a filter. */
function activeFilters(q: Query) {
  return (
    q.industries.length +
    q.sizes.length +
    q.workplaces.length +
    q.disciplines.length +
    q.orgKinds.length +
    (q.hiringOnly ? 1 : 0) +
    (q.openToOnly ? 1 : 0) +
    (q.pastKind !== "all" ? 1 : 0) +
    (q.area ? 1 : 0)
  );
}

/* ---- the list sheet ------------------------------------------------------- */

export type Snap = "peek" | "half" | "full";

/**
 * The list, as a sheet over the map.
 *
 * Three resting places: peeking (a handle and a count, the map is the page),
 * half (both), and full (the list is the page, under the top bar). The handle
 * drags it; a fling carries it to the next stop; the floating button jumps
 * between the ends. The list inside is always exactly as tall as the part of
 * the sheet on screen, so it scrolls to its last row at any height.
 */
export function ListSheet({
  snap,
  onSnap,
  title,
  children,
}: {
  snap: Snap;
  onSnap: (snap: Snap) => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const [vh, setVh] = useState(() => window.innerHeight);
  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const stops: Record<Snap, number> = {
    full: MOBILE_TOP,
    half: Math.round(vh * 0.52),
    peek: vh - PEEK,
  };
  const y = useMotionValue(stops[snap]);
  const height = useTransform(y, (v) => vh - v);
  const drag = useDragControls();

  useEffect(() => {
    const ctl = animate(y, stops[snap], SPRING);
    return () => ctl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, vh]);

  return (
    <motion.section
      aria-label="Results"
      className="glass fixed inset-x-0 top-0 z-20 flex flex-col rounded-t-[1.25rem] border-t shadow-[0_-8px_24px_rgb(0_0_0/0.12)]"
      style={{ y, height }}
      drag="y"
      dragListener={false}
      dragControls={drag}
      dragConstraints={{ top: stops.full, bottom: stops.peek }}
      dragElastic={0.06}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        /* Where it would come to rest if the fling carried on — so a quick
           flick goes to the next stop, not back to where it started. */
        const target = y.get() + info.velocity.y * 0.18;
        const order: Snap[] = ["full", "half", "peek"];
        const next = order.reduce((best, s) =>
          Math.abs(stops[s] - target) < Math.abs(stops[best] - target)
            ? s
            : best,
        );
        if (next === snap) animate(y, stops[next], SPRING);
        else onSnap(next);
      }}
    >
      <div
        className="shrink-0 cursor-grab touch-none px-4 pt-2.5 pb-2 active:cursor-grabbing"
        onPointerDown={(e) => drag.start(e)}
      >
        <div
          className="mx-auto h-1.5 w-10 rounded-full bg-line-3"
          aria-hidden
        />
        <button
          type="button"
          onClick={() => onSnap(snap === "peek" ? "half" : "peek")}
          className="mt-2 block w-full text-center text-sm font-semibold text-ink"
        >
          {title}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </motion.section>
  );
}

/** How much of the sheet shows when it is peeking: the handle and the count. */
const PEEK = 92;
const SPRING = { type: "spring", stiffness: 420, damping: 42 } as const;

/** The floating switch between the map and the list. */
export function MapListToggle({
  snap,
  onSnap,
}: {
  snap: Snap;
  onSnap: (snap: Snap) => void;
}) {
  const showingList = snap === "full";
  return (
    <button
      type="button"
      onClick={() => onSnap(showingList ? "peek" : "full")}
      className="fixed left-1/2 z-30 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-ground shadow-[0_6px_20px_rgb(0_0_0/0.25)] transition-transform active:scale-95"
      style={{
        bottom: showingList
          ? "calc(20px + env(safe-area-inset-bottom))"
          : `calc(${PEEK + 14}px + env(safe-area-inset-bottom))`,
      }}
    >
      {showingList ? (
        <>
          Map <MapIcon className="size-4" />
        </>
      ) : (
        <>
          List <List className="size-4" />
        </>
      )}
    </button>
  );
}

/* ---- detail sheet --------------------------------------------------------- */

/**
 * A company, job or person, as a sheet over the map: tall enough to read,
 * short enough that its pin stays in view above it. Drag the handle down or
 * tap the cross to close.
 */
export function DetailSheet({
  children,
  onClose,
  onBack,
}: {
  children: ReactNode;
  onClose: () => void;
  onBack?: () => void;
}) {
  return (
    <motion.section
      role="dialog"
      aria-label="Details"
      className="glass fixed inset-x-0 bottom-0 z-40 flex h-[68dvh] flex-col rounded-t-[1.25rem] border-t shadow-[0_-8px_24px_rgb(0_0_0/0.18)]"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={SPRING}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 120 || info.velocity.y > 600) onClose();
      }}
    >
      <div className="shrink-0 touch-none pt-2.5">
        <div
          className="mx-auto h-1.5 w-10 rounded-full bg-line-3"
          aria-hidden
        />
        <div className="flex items-center gap-1 px-2 py-1">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ChevronLeft />
              Back
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X />
          </Button>
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]"
        /* The body scrolls; only the handle drags the sheet. */
        onPointerDownCapture={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </motion.section>
  );
}

export { AnimatePresence };

/* ---- filters sheet -------------------------------------------------------- */

/**
 * Filters, the way a phone does them: one full-screen sheet, every option a
 * chip you can see without opening anything, and a button that says how many
 * results you are about to get.
 */
export function FilterSheet({
  open,
  onClose,
  tab,
  query,
  onQuery,
  count,
  noun,
}: {
  open: boolean;
  onClose: () => void;
  tab: Tab;
  query: Query;
  onQuery: (q: Query) => void;
  count: number;
  noun: string;
}) {
  const set = <K extends keyof Query>(key: K, value: Query[K]) =>
    onQuery({ ...query, [key]: value });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          className="fixed inset-0 z-50 flex flex-col bg-ground"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={SPRING}
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <header className="flex shrink-0 items-center border-b border-line px-2 py-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close filters"
            >
              <X />
            </Button>
            <h2 className="flex-1 text-center text-base font-semibold text-ink">
              Filters
            </h2>
            <div className="size-10" />
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            {tab === "community" && (
              <Chips
                title="Type"
                options={ORG_KINDS}
                value={query.orgKinds}
                onChange={(v) => set("orgKinds", v)}
              />
            )}
            {tab === "history" && (
              <section className="border-b border-line py-5">
                <h3 className="mb-3 text-base font-semibold text-ink">Show</h3>
                <Segmented
                  className="w-full"
                  aria-label="Exits or closures"
                  value={query.pastKind}
                  onChange={(v) => set("pastKind", v)}
                  items={[
                    { value: "all", label: "All" },
                    { value: "exited", label: "Exits" },
                    { value: "closed", label: "Graveyard" },
                  ]}
                />
              </section>
            )}
            {(tab === "companies" || tab === "jobs" || tab === "people") && (
              <>
                {tab === "companies" && (
                  <Toggle
                    title="Hiring now"
                    detail="Only companies with an open role"
                    on={query.hiringOnly}
                    onChange={(v) => set("hiringOnly", v)}
                  />
                )}
                {tab === "people" && (
                  <Toggle
                    title="Open to work"
                    detail="Only people who said they're looking"
                    on={query.openToOnly}
                    onChange={(v) => set("openToOnly", v)}
                  />
                )}
                {tab === "jobs" && (
                  <Chips
                    title="Discipline"
                    options={DISCIPLINES}
                    value={query.disciplines}
                    onChange={(v) => set("disciplines", v)}
                  />
                )}
                <Chips
                  title="Industry"
                  options={INDUSTRIES}
                  value={query.industries}
                  onChange={(v) => set("industries", v)}
                />
                <Chips
                  title="Company size"
                  options={SIZE_BANDS}
                  value={query.sizes}
                  onChange={(v) => set("sizes", v)}
                />
                <Chips
                  title="Workplace"
                  options={WORKPLACES}
                  value={query.workplaces}
                  onChange={(v) => set("workplaces", v)}
                />
              </>
            )}
            {query.area && (
              <Toggle
                title="This map area only"
                detail="Set by “Search this area”"
                on
                onChange={() => set("area", null)}
              />
            )}
          </div>

          <footer
            className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 pt-3"
            style={{
              paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
            }}
          >
            <button
              type="button"
              onClick={() => onQuery({ ...EMPTY_QUERY, text: query.text })}
              disabled={!isFiltered({ ...query, text: "" })}
              className="h-12 px-1 text-base font-semibold text-ink underline underline-offset-4 disabled:text-ink-faint disabled:no-underline"
            >
              Clear all
            </button>
            <Button
              size="lg"
              variant="accent"
              onClick={onClose}
              className="h-12 px-6 text-base"
            >
              Show <span className="num">{count}</span> {plural(noun, count)}
            </Button>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Chips<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: readonly T[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <section className="border-b border-line py-5">
      <h3 className="mb-3 text-base font-semibold text-ink">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange(on ? value.filter((v) => v !== o) : [...value, o])
              }
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                on
                  ? "border-ink bg-ink text-ground"
                  : "border-line-2 bg-surface text-ink-2 active:bg-surface-2",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Toggle({
  title,
  detail,
  on,
  onChange,
}: {
  title: string;
  detail: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <section className="flex items-center gap-4 border-b border-line py-5">
      <div className="flex-1">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="text-sm text-ink-3">{detail}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-8 w-13 shrink-0 rounded-full transition-colors",
          on ? "bg-ink" : "bg-line-3",
        )}
      >
        <span
          className={cn(
            "absolute top-1 left-1 size-6 rounded-full bg-solid shadow transition-transform",
            on && "translate-x-5",
          )}
        />
      </button>
    </section>
  );
}

/* ---- menu ----------------------------------------------------------------- */

/** The rail's account, theme and site links, behind one button. */
export function MobileMenu({
  viewer,
  onSignIn,
  onAccount,
  onSignOut,
}: {
  viewer: Viewer | null;
  onSignIn: () => void;
  onAccount: () => void;
  onSignOut: () => void;
}) {
  const { setTheme } = useTheme();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu"
          className="glass grid size-12 shrink-0 place-items-center rounded-full border text-ink shadow-[var(--shadow-card)]"
        >
          <MenuIcon className="size-[1.125rem]" />
        </button>
      </MenuTrigger>
      <MenuContent align="end" className="min-w-56">
        {viewer ? (
          <>
            <MenuLabel>{viewer.email}</MenuLabel>
            <MenuItem onSelect={onAccount}>Your profile</MenuItem>
            <MenuItem onSelect={onSignOut}>Sign out</MenuItem>
          </>
        ) : (
          <MenuItem onSelect={onSignIn}>Sign in</MenuItem>
        )}
        <MenuSeparator />
        <MenuItem onSelect={() => setTheme("light")}>
          <Sun /> Light
        </MenuItem>
        <MenuItem onSelect={() => setTheme("dark")}>
          <Moon /> Dark
        </MenuItem>
        <MenuItem onSelect={() => setTheme("system")}>
          <Monitor /> System
        </MenuItem>
        <MenuSeparator />
        <MenuItem asChild>
          <a href="/employers/">For employers</a>
        </MenuItem>
        <MenuItem asChild>
          <a href="/terms/">Terms of Use</a>
        </MenuItem>
        <MenuItem asChild>
          <a href="/privacy/">Privacy Policy</a>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
