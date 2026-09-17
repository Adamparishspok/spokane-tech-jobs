import { cn } from "@kit/lib/cn";
import { useTheme } from "@kit/lib/theme";
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  MenuTrigger,
} from "@kit/ui";
import { LogIn, Monitor, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import type { Viewer } from "../db/auth";
import { Monogram, Pine } from "../design/brand";

/**
 * The shell.
 *
 * The comps stacked three navigations on one screen: an icon rail down the
 * left, a floating logo tile, and two buttons sitting above the panel — none
 * of which shared an edge with anything, and all of which sat directly on
 * satellite imagery. There is one navigation here. The rail carries the three
 * things the directory is made of and nothing else; the actions live in the
 * panel header, where they are next to the thing they act on.
 */

export type RailItem = {
  id: string;
  label: string;
  icon: ReactNode;
  /** The count beside a nav item. Always derived from the data it labels. */
  count?: number;
};

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-ground">
      {children}
    </div>
  );
}

export function Rail({
  items,
  active,
  onNavigate,
  onAccount,
  viewer,
  onSignIn,
  onSignOut,
}: {
  items: RailItem[];
  active: string;
  onNavigate: (id: string) => void;
  onAccount: () => void;
  /** Null when signed out, which is a normal way to use this product. */
  viewer: Viewer | null;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  return (
    <nav
      aria-label="Sections"
      className="glass z-30 flex w-16 shrink-0 flex-col items-center gap-1 border-r py-3"
    >
      <button
        type="button"
        onClick={() => onNavigate(items[0].id)}
        className="mb-2 grid size-10 place-items-center rounded-field text-brand transition-colors hover:bg-brand-faint"
        aria-label="Spokane Tech Jobs — home"
      >
        <Pine className="size-[1.375rem]" />
      </button>

      {items.map((item) => (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onNavigate(item.id)}
              /* The tooltip is not an accessible name — it is a hover
                 affordance. An icon button needs its own label or it reads as
                 "button" and nothing else. */
              aria-label={item.label}
              aria-current={active === item.id ? "page" : undefined}
              className={cn(
                "relative grid size-11 place-items-center rounded-field transition-colors [&_svg]:size-[1.125rem]",
                active === item.id
                  ? "bg-brand-faint text-brand-2"
                  : "text-ink-4 hover:bg-surface-2 hover:text-ink-2",
              )}
            >
              {item.icon}
              {/* The active mark is a bar on the rail's own edge, not a
                  colour change alone — colour is the one cue a third of
                  people cannot rely on. */}
              {active === item.id && (
                <span className="absolute top-1/2 -right-2.5 h-5 w-[3px] -translate-y-1/2 rounded-l-full bg-brand" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {item.label}
            {item.count !== undefined && (
              <span className="num ml-1.5 text-ink-4">{item.count}</span>
            )}
          </TooltipContent>
        </Tooltip>
      ))}

      <div className="flex-1" />

      <ThemeToggle />

      {viewer ? (
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              className="mt-1 rounded-full outline-none"
              aria-label={`Account — ${viewer.name}`}
            >
              <Monogram
                name={viewer.name}
                hue={viewer.hue}
                round
                className="size-9 text-[0.75rem]"
              />
            </button>
          </MenuTrigger>
          <MenuContent side="right" align="end">
            <MenuLabel>{viewer.email}</MenuLabel>
            <MenuSeparator />
            <MenuItem onSelect={onAccount}>Your profile</MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={onSignOut}>Sign out</MenuItem>
          </MenuContent>
        </Menu>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onSignIn}
              aria-label="Sign in"
              className="mt-1"
            >
              <LogIn />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Sign in</TooltipContent>
        </Tooltip>
      )}
    </nav>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const icon =
    theme === "dark" ? <Moon /> : theme === "light" ? <Sun /> : <Monitor />;

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Theme">
          {icon}
        </Button>
      </MenuTrigger>
      <MenuContent side="right" align="end">
        <MenuItem onSelect={() => setTheme("light")}>
          <Sun /> Light
        </MenuItem>
        <MenuItem onSelect={() => setTheme("dark")}>
          <Moon /> Dark
        </MenuItem>
        <MenuItem onSelect={() => setTheme("system")}>
          <Monitor /> System
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/**
 * A panel that floats over the map.
 *
 * It is opaque and it has an edge. That is the whole fix for the comps, where
 * list text sat directly on aerial photography and the only thing separating a
 * company name from a parking lot was luck.
 */
export function Panel({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "glass flex flex-col overflow-hidden rounded-panel border",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

/**
 * Pluralise a noun. One map, used by the header and by every empty state, so
 * two places cannot disagree — and so "company" never comes out "companys",
 * which is what an `+ "s"` at the call site produced.
 */
const IRREGULAR: Record<string, string> = {
  company: "companies",
  person: "people",
};

export const plural = (noun: string, n: number) =>
  n === 1 ? noun : (IRREGULAR[noun] ?? `${noun}s`);

export function PanelHeader({
  title,
  count,
  noun,
  actions,
  children,
}: {
  title: string;
  count: number;
  /** Singular; pluralised here so two screens cannot disagree. */
  noun: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="shrink-0 border-b border-line px-4 pt-4 pb-3">
      <div className="flex items-center gap-3">
        <h1 className="text-[1.0625rem] font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {/* The count is derived, every time. The comps printed "11 Results"
            over eight identical rows. */}
        <span className="num text-[0.8125rem] text-ink-3">
          {count} {plural(noun, count)}
        </span>
        <div className="flex-1" />
        {actions}
      </div>
      {children}
    </header>
  );
}

/** A label above a value, the pattern every detail block uses. */
export function Fact({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 text-ink-4 [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[0.6875rem] font-medium tracking-wide text-ink-4 uppercase">
          {label}
        </dt>
        <dd className="text-sm text-ink-2">{children}</dd>
      </div>
    </div>
  );
}

export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "hiring" | "brand";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-chip px-1.5 py-0.5 text-[0.75rem] font-medium whitespace-nowrap",
        tone === "hiring" && "bg-hiring-soft text-hiring-2",
        tone === "brand" && "bg-brand-soft text-brand-deep",
        tone === "neutral" && "bg-surface-3 text-ink-3",
      )}
    >
      {children}
    </span>
  );
}

/**
 * What a filtered list shows when it matches nothing.
 *
 * It names the filters that are responsible and offers the one action that
 * ends the emptiness, because "No results" on its own is a dead end — and a
 * dead end is exactly where a directory of a mid-size city puts people most
 * often.
 */
export function NoResults({
  noun,
  onClear,
}: {
  noun: string;
  onClear: () => void;
}) {
  return (
    <Blank
      title={`No ${plural(noun, 0)} match these filters`}
      body="Spokane is not a large market. Widening one filter usually finds something."
      action={
        <Button size="sm" onClick={onClear}>
          Clear filters
        </Button>
      }
    />
  );
}

/**
 * The first day, which is not the same screen as a filter that matched
 * nothing and must not say the same thing.
 *
 * A directory with no companies in it has no jobs and no people either, and
 * none of that is anybody's filter being too narrow. Blaming the filters here
 * — which is what a single shared "No results" does — sends a person to clear
 * filters that are already clear. Each of the three says what its own tab is
 * for and what ends the emptiness.
 */
export function FirstDay({
  tab,
  onAdd,
}: {
  tab: "companies" | "jobs" | "people";
  onAdd: () => void;
}) {
  const copy = {
    companies: {
      title: "Nothing on the map yet",
      body: "The directory starts empty and fills up by hand. Add the first company — yours, or one you know of.",
      action: "Add a company",
    },
    jobs: {
      title: "No roles posted yet",
      body: "Roles are posted by the companies in the directory, so a company has to be on the map before a job can be.",
      action: "Add a company",
    },
    people: {
      title: "Nobody here yet",
      body: "People show up once they add a profile. Yours is the obvious place to start.",
      action: "Set up your profile",
    },
  }[tab];

  return (
    <Blank
      title={copy.title}
      body={copy.body}
      action={
        <Button size="sm" variant="accent" onClick={onAdd}>
          {copy.action}
        </Button>
      }
    />
  );
}

function Blank({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-60 text-[0.8125rem] leading-relaxed text-ink-3">
        {body}
      </p>
      {action}
    </div>
  );
}
