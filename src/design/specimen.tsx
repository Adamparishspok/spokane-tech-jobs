import { useTheme, type Theme } from "@kit/lib/theme";
import {
  Badge,
  Button,
  Checkbox,
  Segmented,
  Separator,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TooltipProvider,
} from "@kit/ui";
import { Monitor, Moon, Plus, Sun } from "lucide-react";
import { useState } from "react";
import { payRange, postedLabel } from "../domain";
import { useDirectory } from "../db/directory";
import { Basemap } from "../map/basemap";
import { HOME } from "../map/spokane";
import { Fact, Tag } from "../app/chrome";
import { MultiFilter, SearchField, TogglePill } from "../app/filters";
import { Monogram, Pine, Wordmark } from "./brand";
import { MapPin } from "lucide-react";

/**
 * The design system on one page.
 *
 * Not a screen in the product. It exists so a retheme has one place that
 * proves the whole thing still holds, and because every colour here is a
 * token: anything that fails to invert when the theme switches is a hard-coded
 * value somewhere, and this is where that shows up first.
 *
 * The map swatch is on it deliberately. In a product whose centrepiece is a
 * map, the basemap is part of the design system — if its land, water and roads
 * are not on the specimen beside the ink ramp, nobody notices when they stop
 * relating to it.
 */
export function Specimen() {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState("about");
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>(["Health tech"]);
  const [hiring, setHiring] = useState(true);

  const THEMES: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <Sun /> },
    { value: "dark", label: "Dark", icon: <Moon /> },
    { value: "system", label: "System", icon: <Monitor /> },
  ];

  /* The specimen reads the live directory rather than a fixture of its own.
     A design system page showing rows the product cannot actually produce is
     the first place a component and its data drift apart — and when the
     directory is empty or unreachable it falls back, because a broken
     database should not take the token page down with it. */
  const { companies, jobs } = useDirectory();
  const company = companies[0] ?? FALLBACK_COMPANY;
  const job = jobs[0] ?? FALLBACK_JOB;

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-5xl px-8 py-10">
        <header className="flex items-center gap-4">
          <Wordmark />
          <div className="flex-1" />
          <Segmented
            value={theme}
            onChange={setTheme}
            items={THEMES.map((t) => ({
              value: t.value,
              label: t.label,
              icon: t.icon,
            }))}
          />
        </header>

        <Section title="Grounds and ink">
          <div className="grid grid-cols-6 gap-2">
            {[
              ["ground", "bg-ground"],
              ["panel", "bg-panel"],
              ["surface", "bg-surface"],
              ["surface-2", "bg-surface-2"],
              ["surface-3", "bg-surface-3"],
              ["field", "bg-field"],
            ].map(([name, cls]) => (
              <Swatch key={name} name={name} className={cls} />
            ))}
          </div>
          <div className="mt-4 grid gap-1">
            {[
              ["ink", "text-ink"],
              ["ink-2", "text-ink-2"],
              ["ink-3", "text-ink-3"],
              ["ink-4", "text-ink-4"],
            ].map(([name, cls]) => (
              <p key={name} className={`text-sm ${cls}`}>
                <span className="num mr-3 text-[0.75rem] opacity-60">
                  {name}
                </span>
                {/* Derived, even here. A specimen that prints a number the
                    product would disagree with is the first place a stale
                    figure hides. */}
                <span className="num">{companies.length}</span> companies and{" "}
                <span className="num">{jobs.length}</span> open roles across the
                Inland Northwest.
              </p>
            ))}
          </div>
        </Section>

        <Section title="Brand, accent and hiring">
          <div className="grid grid-cols-6 gap-2">
            {[
              ["brand", "bg-brand"],
              ["brand-2", "bg-brand-2"],
              ["brand-soft", "bg-brand-soft"],
              ["brand-faint", "bg-brand-faint"],
              ["accent", "bg-accent"],
              ["hiring", "bg-hiring"],
            ].map(([name, cls]) => (
              <Swatch key={name} name={name} className={cls} />
            ))}
          </div>
          <p className="mt-3 max-w-prose text-[0.8125rem] leading-relaxed text-ink-3">
            Brand and accent are separate on purpose: green is the product's own
            voice — nav, links, map marks — and basalt is the surface a
            committed action sits on. Ember is neither. It has one job, which is
            a company with an open role, and it never means "good".
          </p>
        </Section>

        <Section title="The basemap">
          <div className="relative h-64 overflow-hidden rounded-panel border border-line-2">
            <Basemap camera={HOME} size={{ width: 1040, height: 256 }} />
            <span className="num absolute top-1/2 left-1/2 flex h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-surface bg-hiring px-1.5 text-[0.75rem] font-semibold text-white shadow-[var(--shadow-marker)]">
              3
            </span>
          </div>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {[
              ["map", "bg-map"],
              ["map-2", "bg-map-2"],
              ["map-park", "bg-map-park"],
              ["map-water", "bg-map-water"],
              ["map-road", "bg-map-road"],
              ["map-road-2", "bg-map-road-2"],
            ].map(([name, cls]) => (
              <Swatch key={name} name={name} className={cls} />
            ))}
          </div>
        </Section>

        <Section title="Type">
          <div className="grid gap-3">
            <p className="font-display text-[2rem] leading-tight text-ink">
              Get on the map
            </p>
            <p className="text-[1.0625rem] font-semibold tracking-tight text-ink">
              Panel title — 17px semibold
            </p>
            <p className="text-sm font-semibold text-ink">
              Row title — 14px semibold
            </p>
            <p className="text-sm text-ink-2">
              Body — 14px regular. The workhorse, and what every paragraph in
              the detail column is set in.
            </p>
            <p className="text-[0.8125rem] text-ink-3">
              Secondary — 13px. Taglines, hints, everything under a name.
            </p>
            <p className="text-[0.75rem] text-ink-4">
              Meta — 12px. Districts, dates, skills.
            </p>
            <p className="text-[0.6875rem] font-medium tracking-wide text-ink-4 uppercase">
              Label — 11px uppercase
            </p>
            <p className="num text-sm text-ink-2">
              Tabular: 124 · 2014 · $145k–$178k · (509) 555-0142
            </p>
          </div>
        </Section>

        <Section title="Controls">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="accent">
              <Plus />
              Post a job
            </Button>
            <Button variant="brand">Brand</Button>
            <Button>Outline</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Switch checked={on} onCheckedChange={setOn} />
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => setChecked(!!v)}
              />
              Open to work
            </label>
            <Badge variant="count">34</Badge>
            <Tag>Hybrid</Tag>
            <Tag tone="brand">Health tech</Tag>
            <Tag tone="hiring">3 open roles</Tag>
          </div>
          <div className="mt-4 max-w-sm">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search companies, industries…"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <MultiFilter
              label="Industry"
              options={
                ["Health tech", "Aerospace", "Games", "Fintech"] as const
              }
              value={picked}
              onChange={setPicked}
            />
            <TogglePill
              label="Hiring"
              tone="hiring"
              active={hiring}
              onChange={setHiring}
            />
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="jobs">
                Jobs <span className="num text-ink-4">3</span>
              </TabsTrigger>
              <TabsTrigger value="people">
                People <span className="num text-ink-4">1</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Section>

        <Section title="Records">
          <div className="grid grid-cols-2 gap-4">
            <div className="overflow-hidden rounded-panel border border-line-2 bg-panel">
              <div className="flex gap-3 px-4 py-3">
                <Monogram name={company.name} hue={company.hue} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <h3 className="truncate text-sm font-semibold text-ink">
                      {company.name}
                    </h3>
                    <span className="num ml-auto text-[0.75rem] font-semibold text-hiring">
                      3 open
                    </span>
                  </div>
                  <p className="truncate text-[0.8125rem] text-ink-3">
                    {company.tagline}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[0.75rem] text-ink-4">
                    <MapPin className="size-3" />
                    Downtown · 51–200 · Health tech
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex gap-3 px-4 py-3">
                <Monogram name="Daniel Reyes" hue={342} round />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <h3 className="truncate text-sm font-semibold text-ink">
                      Daniel Reyes
                    </h3>
                    <span className="ml-auto">
                      <Tag tone="hiring">Open</Tag>
                    </span>
                  </div>
                  <p className="truncate text-[0.8125rem] text-ink-3">
                    Product Designer
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-panel border border-line-2 bg-panel p-4">
              <h3 className="text-sm leading-snug font-semibold text-ink">
                {job.title}
              </h3>
              <p className="text-[0.8125rem] text-ink-3">
                {company.name} · Downtown
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <Tag tone="brand">{payRange(job)}</Tag>
                <Tag>{job.workplace}</Tag>
                <span className="num ml-auto text-[0.75rem] text-ink-4">
                  {postedLabel(job.posted)}
                </span>
              </div>
              <Separator className="my-3" />
              <dl className="grid gap-3">
                <Fact icon={<MapPin />} label="Downtown">
                  {company.address}
                </Fact>
              </dl>
            </div>
          </div>
        </Section>

        <Section title="The mark">
          <div className="flex items-end gap-6 text-brand">
            <Pine className="size-6" />
            <Pine className="size-10" />
            <Pine className="size-16" />
            <Wordmark className="ml-4" />
          </div>
        </Section>
      </div>
    </TooltipProvider>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[0.6875rem] font-medium tracking-wide text-ink-4 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div>
      <div
        className={`h-12 rounded-card border border-line-2 ${className}`}
        aria-hidden
      />
      <p className="mt-1 text-[0.6875rem] text-ink-4">{name}</p>
    </div>
  );
}

/* Enough of a row to draw the specimen against an empty database. */
const FALLBACK_COMPANY = {
  id: "example",
  name: "Latah Systems",
  hue: 152,
  tagline: "Scheduling for rural hospital networks",
  about: "",
  industry: "Health tech",
  headcount: 124,
  founded: 2014,
  stage: "Series B",
  workplace: "Hybrid",
  district: "downtown",
  address: "601 W Riverside Ave, Suite 1400",
  zip: "99201",
  lng: -117.4243,
  lat: 47.6586,
  website: "",
  email: "",
  phone: "",
  claimed: true,
} as const satisfies import("../domain").Company;

const FALLBACK_JOB = {
  id: "example-job",
  companyId: "example",
  title: "Senior Backend Engineer, Scheduling",
  discipline: "Engineering",
  level: "Senior",
  employment: "Full-time",
  workplace: "Hybrid",
  payLow: 145000,
  payHigh: 178000,
  posted: 2,
  summary: "",
  responsibilities: [],
  requirements: [],
} as const satisfies import("../domain").Job;
