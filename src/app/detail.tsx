import { cn } from "@kit/lib/cn";
import {
  Button,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@kit/ui";
import {
  ArrowUpRight,
  Bookmark,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  Globe,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  districtLabel,
  payRange,
  postedLabel,
  sizeBand,
  type Company,
  type Job,
  type Person,
} from "../domain";
import { useViewer } from "../db/auth";
import { useDirectory } from "../db/directory";
import { useMine } from "../db/mine";
import { Monogram, logoFor } from "../design/brand";
import { Fact, Panel, Tag } from "./chrome";
import { ClaimListing } from "./forms";

/**
 * The detail column.
 *
 * In the comps this was a drawer that covered the right third of the map —
 * including, reliably, the pin you had just clicked to open it. Here it is a
 * third column: the map keeps the space between the two panels and recentres
 * the selected pin into it when the column opens. You can see the thing you
 * are reading about, which for a map product is not a nicety.
 *
 * The comps also reused one block of fields for everything. A person's detail
 * screen printed "Martech Industry · 1–10 Employees · Founded in 2013" under
 * their name, which are a company's facts. Each record type has its own block
 * here.
 */

export function DetailPanel({
  children,
  onClose,
  onBack,
}: {
  children: React.ReactNode;
  onClose: () => void;
  onBack?: () => void;
}) {
  return (
    <Panel className="pointer-events-auto w-[25rem] shrink-0">
      <div className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-2">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft />
            Back
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close"
        >
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </Panel>
  );
}

export function CompanyDetail({
  company,
  onJob,
  onPerson,
  onSignIn,
}: {
  company: Company;
  onJob: (job: Job) => void;
  onPerson: (person: Person) => void;
  onSignIn: () => void;
}) {
  const { jobsAt, peopleAt } = useDirectory();
  const viewer = useViewer();
  const { hasClaimRequest, noteClaimRequest } = useMine();
  const jobs = jobsAt(company.id);
  const people = peopleAt(company.id);
  const [tab, setTab] = useState("about");
  const [claiming, setClaiming] = useState(false);
  const requested = hasClaimRequest(company.id);

  return (
    <article>
      <header className="px-5 pt-4 pb-4">
        <div className="flex items-start gap-3">
          <Monogram
            name={company.name}
            hue={company.hue}
            logo={company.logo ?? logoFor(company.id)}
            className="size-12 text-base"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg leading-tight font-semibold tracking-tight text-ink">
              {company.name}
            </h2>
            <p className="text-[0.8125rem] text-ink-3">{company.tagline}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          <Tag tone="brand">{company.industry}</Tag>
          {company.stage && <Tag>{company.stage}</Tag>}
          {company.workplace && <Tag>{company.workplace}</Tag>}
          {jobs.length > 0 && (
            <Tag tone="hiring">
              {jobs.length} open {jobs.length === 1 ? "role" : "roles"}
            </Tag>
          )}
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="px-5">
          <TabsList>
            <TabsTrigger value="about">About</TabsTrigger>
            {/* A tab that leads to nothing is not offered. The comps drew
                INFO / JOBS / PEOPLE on every company regardless. */}
            {jobs.length > 0 && (
              <TabsTrigger value="jobs">
                Jobs
                <span className="num text-ink-4">{jobs.length}</span>
              </TabsTrigger>
            )}
            {people.length > 0 && (
              <TabsTrigger value="people">
                People
                <span className="num text-ink-4">{people.length}</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="about" className="px-5 py-4">
          <p className="text-sm leading-relaxed text-ink-2">{company.about}</p>

          <dl className="mt-5 grid gap-4">
            {/* A fact nobody has sourced is left out rather than printed as
                an em dash: an absent row reads as "not known", and a row
                reading "—" reads as "known to be nothing". */}
            {company.headcount !== null && (
              <Fact icon={<Users />} label="Team">
                <span className="num">{company.headcount}</span> people ·{" "}
                {sizeBand(company.headcount)}
              </Fact>
            )}
            {company.founded !== null && (
              <Fact icon={<CalendarDays />} label="Founded">
                <span className="num">{company.founded}</span> ·{" "}
                <span className="num">
                  {new Date().getFullYear() - company.founded}
                </span>{" "}
                years
              </Fact>
            )}
            <Fact icon={<MapPin />} label={districtLabel(company.district)}>
              {company.address}
              <br />
              Spokane, WA <span className="num">{company.zip}</span>
            </Fact>
            <Fact icon={<Globe />} label="Website">
              <a
                href={`https://${company.website}`}
                className="inline-flex items-center gap-0.5 font-medium text-brand-2 underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer noopener"
              >
                {company.website}
                <ArrowUpRight className="size-3.5" />
              </a>
            </Fact>
            <Fact icon={<Mail />} label="Email">
              <a
                href={`mailto:${company.email}`}
                className="font-medium text-brand-2 underline-offset-2 hover:underline"
              >
                {company.email}
              </a>
            </Fact>
            <Fact icon={<Phone />} label="Phone">
              <span className="num">{company.phone}</span>
            </Fact>
          </dl>

          <Separator className="my-5" />

          {/* Claiming is the directory's one unsolved problem, so it says which
              state a listing is in rather than showing the same button to
              everyone — which is what the comps did, under a listing that was
              already claimed. */}
          {company.claimed ? (
            <p className="flex items-center gap-2 text-[0.8125rem] text-ink-3">
              <ShieldCheck className="size-4 text-ok" />
              Claimed and kept current by someone who works here.
            </p>
          ) : requested ? (
            /* Asked and waiting. Offering the button again here would invite
               the second ask a person makes when the first one left no trace,
               and the table refuses it anyway — one claim per person per
               company. */
            <p className="flex items-center gap-2 text-[0.8125rem] text-ink-3">
              <Check className="size-4 text-ok" />
              You have asked to claim this. Someone checks it by hand.
            </p>
          ) : (
            <div className="rounded-card border border-line-2 bg-surface-2 p-3">
              <p className="text-[0.8125rem] text-ink-2">
                Nobody from {company.name} has claimed this listing. The details
                came from public sources and may be out of date.
              </p>
              <Button
                size="sm"
                className="mt-2.5"
                onClick={() => (viewer ? setClaiming(true) : onSignIn())}
              >
                Claim this listing
              </Button>
            </div>
          )}
        </TabsContent>

        {jobs.length > 0 && (
          <TabsContent value="jobs" className="p-2">
            <ul className="grid gap-1">
              {jobs.map((job) => (
                <li key={job.id}>
                  <button
                    type="button"
                    onClick={() => onJob(job)}
                    className="w-full rounded-card px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <h4 className="text-sm font-semibold text-ink">
                      {job.title}
                    </h4>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <Tag tone="brand">{payRange(job)}</Tag>
                      <Tag>{job.workplace}</Tag>
                      <span className="num ml-auto text-[0.75rem] text-ink-4">
                        {postedLabel(job.posted)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </TabsContent>
        )}

        {people.length > 0 && (
          <TabsContent value="people" className="p-2">
            <ul className="grid gap-1">
              {people.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => onPerson(person)}
                    className="flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <Monogram
                      name={person.name}
                      hue={person.hue}
                      round
                      className="size-9"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-semibold text-ink">
                        {person.name}
                      </h4>
                      <p className="truncate text-[0.8125rem] text-ink-3">
                        {person.role}
                      </p>
                    </div>
                    {person.openTo && <Tag tone="hiring">Open</Tag>}
                  </button>
                </li>
              ))}
            </ul>
          </TabsContent>
        )}
      </Tabs>

      {/* Outside the tabs: switching to Jobs mid-claim should not close the
          dialog the person is typing into. */}
      <ClaimListing
        company={company}
        open={claiming}
        onOpenChange={setClaiming}
        onSubmitted={() => noteClaimRequest(company.id)}
      />
    </article>
  );
}

export function JobDetail({
  job,
  company,
  onCompany,
  onSignIn,
}: {
  job: Job;
  company: Company;
  onCompany: (company: Company) => void;
  onSignIn: () => void;
}) {
  const viewer = useViewer();
  const { isSaved, toggleSave, savingJobId, error } = useMine();
  const saved = isSaved(job.id);

  return (
    <article className="px-5 py-4">
      <header>
        <h2 className="text-lg leading-tight font-semibold tracking-tight text-ink">
          {job.title}
        </h2>
        <button
          type="button"
          onClick={() => onCompany(company)}
          className="mt-2 flex items-center gap-2.5 rounded-card text-left"
        >
          <Monogram name={company.name} hue={company.hue} className="size-9" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink underline-offset-2 hover:underline">
              {company.name}
            </span>
            <span className="block truncate text-[0.8125rem] text-ink-3">
              {districtLabel(company.district)} · {sizeBand(company.headcount)}
            </span>
          </span>
        </button>
      </header>

      {/* The three facts that decide whether the rest is worth reading, above
          the fold and in the same order on every listing. */}
      <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-card border border-line-2 bg-line">
        <KeyFact label="Pay">{payRange(job)}</KeyFact>
        <KeyFact label="Workplace">{job.workplace}</KeyFact>
        <KeyFact label="Type">{job.employment}</KeyFact>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-1">
        <Tag>{job.discipline}</Tag>
        <Tag>{job.level}</Tag>
        <span className="num ml-auto text-[0.75rem] text-ink-4">
          Posted {postedLabel(job.posted).toLowerCase()}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="accent" block>
          Apply
          <ArrowUpRight />
        </Button>
        <Button
          variant={saved ? "subtle" : "outline"}
          size="icon"
          aria-pressed={saved}
          aria-label={saved ? "Saved" : "Save this job"}
          disabled={savingJobId === job.id}
          /* Saving is the one thing here that needs an account, so the button
             asks for one rather than failing at the policy and reporting it. */
          onClick={() => (viewer ? toggleSave(job.id) : onSignIn())}
        >
          {saved ? <Check /> : <Bookmark />}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-[0.8125rem] text-danger">
          {error}
        </p>
      )}

      <p className="mt-5 text-sm leading-relaxed text-ink-2">{job.summary}</p>

      <Section title="What you would do" items={job.responsibilities} />
      <Section title="What we are looking for" items={job.requirements} />

      <Separator className="my-5" />

      <button
        type="button"
        onClick={() => onCompany(company)}
        className="flex w-full items-center gap-2 rounded-card border border-line-2 bg-surface-2 px-3 py-2.5 text-left text-[0.8125rem] text-ink-2 transition-colors hover:bg-surface-3"
      >
        <Building2 className="size-4 text-ink-4" />
        More about {company.name}
        <ArrowUpRight className="ml-auto size-4 text-ink-4" />
      </button>
    </article>
  );
}

function KeyFact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface px-3 py-2">
      <dt className="text-[0.6875rem] font-medium tracking-wide text-ink-4 uppercase">
        {label}
      </dt>
      <dd className="num mt-0.5 text-[0.8125rem] font-semibold text-ink">
        {children}
      </dd>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-5">
      <h3 className="text-[0.6875rem] font-medium tracking-wide text-ink-4 uppercase">
        {title}
      </h3>
      <ul className="mt-2 grid gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2.5 text-sm leading-relaxed text-ink-2"
          >
            <span
              className="mt-[0.5em] size-1 shrink-0 rounded-full bg-brand"
              aria-hidden
            />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PersonDetail({
  person,
  company,
  onCompany,
}: {
  person: Person;
  company: Company | null;
  onCompany: (company: Company) => void;
}) {
  return (
    <article className="px-5 py-4">
      <header className="flex items-start gap-3">
        <Monogram
          name={person.name}
          hue={person.hue}
          round
          className="size-12 text-base"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-semibold tracking-tight text-ink">
            {person.name}
          </h2>
          <p className="text-[0.8125rem] text-ink-3">{person.role}</p>
        </div>
        {person.openTo && <Tag tone="hiring">Open to work</Tag>}
      </header>

      <p className="mt-4 text-sm leading-relaxed text-ink-2">{person.bio}</p>

      {/* A person's facts, not a company's. */}
      <dl className="mt-5 grid gap-4">
        <Fact icon={<Briefcase />} label="Experience">
          <span className="num">{person.years}</span> years
        </Fact>
        {company ? (
          <Fact icon={<Building2 />} label="Works at">
            <button
              type="button"
              onClick={() => onCompany(company)}
              className="font-medium text-brand-2 underline-offset-2 hover:underline"
            >
              {company.name}
            </button>
          </Fact>
        ) : (
          <Fact icon={<Building2 />} label="Currently">
            Between roles
          </Fact>
        )}
        <Fact icon={<MapPin />} label="Based in">
          {districtLabel(person.district)}, Spokane
        </Fact>
      </dl>

      <section className="mt-5">
        <h3 className="text-[0.6875rem] font-medium tracking-wide text-ink-4 uppercase">
          Skills
        </h3>
        <div className="mt-2 flex flex-wrap gap-1">
          {person.skills.map((skill) => (
            <Tag key={skill}>{skill}</Tag>
          ))}
        </div>
      </section>

      <Button variant="accent" block className="mt-6">
        <Mail />
        Get in touch
      </Button>
      <p className="mt-2 text-center text-[0.75rem] text-ink-4">
        Introductions go through Spokane Tech Jobs. {person.name.split(" ")[0]}{" "}
        sees your message before you see their address.
      </p>
    </article>
  );
}

/** The empty right column, before anything is selected. */
export function DetailHint({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none flex w-[25rem] shrink-0 items-end justify-center pb-6",
        className,
      )}
      aria-hidden
    />
  );
}
