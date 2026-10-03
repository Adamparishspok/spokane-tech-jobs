import { cn } from "@kit/lib/cn";
import {
  Button,
  Input,
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
  districtPlace,
  districtFull,
  payRange,
  postedLabel,
  sizeBand,
  type Company,
  type Job,
  type Person,
  type Place,
  placeKindLabel,
} from "../domain";
import { sendVerificationCode, useViewer, verifyEmailCode } from "../db/auth";
import { useDirectory } from "../db/directory";
import { useMine } from "../db/mine";
import { claimPerson, refreshJob, type ClaimResult } from "../db/mutations";
import { Monogram, PlaceMark, logoFor } from "../design/brand";
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
              {districtPlace(company.district)}{" "}
              <span className="num">{company.zip}</span>
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

      {viewer && job.postedBy === viewer.id && <Expiry job={job} />}

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
  onPlace,
}: {
  person: Person;
  company: Company | null;
  onCompany: (company: Company) => void;
  onPlace: (place: Place) => void;
}) {
  const { placesOf } = useDirectory();
  const places = placesOf(person.id);
  /* A profile somebody else listed says only what was sourced: no years
     defaulted to zero, no "between roles" read into a missing company, no
     neighbourhood. Those are the person's to say once they claim it. */
  const own = Boolean(person.userId);

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

      {person.bio && (
        <p className="mt-4 text-sm leading-relaxed text-ink-2">{person.bio}</p>
      )}

      {/* A person's facts, not a company's. */}
      <dl className="mt-5 grid gap-4">
        {person.years > 0 && (
          <Fact icon={<Briefcase />} label="Experience">
            <span className="num">{person.years}</span> years
          </Fact>
        )}
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
        ) : own ? (
          <Fact icon={<Building2 />} label="Currently">
            Between roles
          </Fact>
        ) : null}
        {person.district && (
          <Fact icon={<MapPin />} label="Based in">
            {districtFull(person.district)}
          </Fact>
        )}
      </dl>

      {places.length > 0 && (
        <section className="mt-5">
          <h3 className="text-[0.6875rem] font-medium tracking-wide text-ink-4 uppercase">
            Around the community
          </h3>
          <ul className="mt-2 grid gap-1">
            {places.map(({ place, role }) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => onPlace(place)}
                  className="flex w-full items-center gap-3 rounded-card px-2 py-1.5 text-left hover:bg-surface-2"
                >
                  <PlaceMark
                    id={place.id}
                    name={place.name}
                    kind={place.kind}
                    className="size-8"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {place.name}
                    </span>
                    <span className="block truncate text-[0.75rem] text-ink-3">
                      {role || placeKindLabel(place.kind)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {person.skills.length > 0 && (
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
      )}

      {/* Only somebody who is here can be introduced. An unclaimed profile
          has nobody behind it to read the message. */}
      {own && (
        <>
          <Button variant="accent" block className="mt-6">
            <Mail />
            Get in touch
          </Button>
          <p className="mt-2 text-center text-[0.75rem] text-ink-4">
            Introductions go through Spokane Tech Jobs.{" "}
            {person.name.split(" ")[0]} sees your message before you see their
            address.
          </p>
        </>
      )}

      {!person.userId && <ClaimProfile person={person} />}
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

/**
 * The poster's own view of a listing's clock. Listings run ninety days; the
 * person who posted one sees how many are left and can put it back to ninety.
 * Nobody else sees this — to a reader the expiry is noise.
 */
function Expiry({ job }: { job: Job }) {
  const { refresh } = useDirectory();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const left = job.expiresAt
    ? Math.max(
        0,
        Math.ceil((Date.parse(job.expiresAt) - Date.now()) / 86_400_000),
      )
    : null;

  return (
    <div className="mt-3 flex items-center gap-3 rounded-card border border-line-2 px-3 py-2 text-[0.8125rem]">
      <span className="text-ink-3">
        Your listing ·{" "}
        <span className="num text-ink-2">
          {left === null
            ? "expiry unknown"
            : `${left} ${left === 1 ? "day" : "days"} left`}
        </span>
      </span>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(null);
          try {
            await refreshJob(job.id);
            refresh();
          } catch (e) {
            setFailed(e instanceof Error ? e.message : "Could not refresh");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Refreshing…" : "Refresh for 90 days"}
      </Button>
      {failed && (
        <span role="alert" className="text-danger">
          {failed}
        </span>
      )}
    </div>
  );
}

const CLAIM_SAYS: Record<
  Exclude<ClaimResult, "claimed" | "unverified">,
  string
> = {
  "no-match":
    "Your account's email doesn't match the one we have for this profile. Sign in with that address to claim it.",
  "has-profile": "Your account already has a profile.",
  taken: "Somebody has already claimed this profile.",
  "signed-out": "Sign in first.",
};

/**
 * "Is this you?" on a profile nobody has claimed.
 *
 * The proof is an email address: the profile has one on file, privately, and
 * an account whose verified address matches it takes the profile over. An
 * account signed up with a password has not verified anything yet, so the
 * first attempt may ask for a six-digit code — after which the same button
 * works.
 */
function ClaimProfile({ person }: { person: Person }) {
  const viewer = useViewer();
  const { refresh } = useDirectory();
  const [step, setStep] = useState<"ask" | "code">("ask");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const first = person.name.split(" ")[0];

  if (!viewer)
    return (
      <p className="mt-6 border-t border-line pt-4 text-[0.8125rem] text-ink-3">
        Are you {first}? Sign in with the email address this profile was listed
        under to take it over.
      </p>
    );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const claim = () =>
    run(async () => {
      const result = await claimPerson(person.id);
      if (result === "claimed") return refresh();
      if (result === "unverified") {
        await sendVerificationCode(viewer.email);
        setStep("code");
        setNote(`We sent a six-digit code to ${viewer.email}.`);
        return;
      }
      setNote(CLAIM_SAYS[result]);
    });

  const verify = () =>
    run(async () => {
      await verifyEmailCode(viewer.email, code.trim());
      setStep("ask");
      setCode("");
      const result = await claimPerson(person.id);
      if (result === "claimed") return refresh();
      setNote(
        result === "unverified"
          ? "That code didn't verify your email. Try sending a new one."
          : CLAIM_SAYS[result],
      );
    });

  return (
    <section className="mt-6 border-t border-line pt-4">
      <h3 className="text-sm font-semibold text-ink">Is this you?</h3>
      <p className="mt-1 text-[0.8125rem] text-ink-3">
        If your account's email matches the one this profile was listed under,
        you can take it over and edit it.
      </p>
      {step === "ask" ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={busy}
          onClick={claim}
        >
          <ShieldCheck />
          {busy ? "Checking…" : `Claim ${first}'s profile`}
        </Button>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
        >
          <Input
            aria-label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-32"
          />
          <Button
            type="submit"
            size="sm"
            disabled={busy || code.trim().length < 6}
          >
            {busy ? "Verifying…" : "Verify and claim"}
          </Button>
        </form>
      )}
      {note && (
        <p role="status" className="mt-2 text-[0.8125rem] text-ink-3">
          {note}
        </p>
      )}
    </section>
  );
}

/**
 * A place in the community: why a tech person would go, when (for a meetup),
 * where, and who from the People list is there. Every line of it is sourced,
 * and the sources are shown — a recommendation nobody can check is just an
 * advert.
 */
export function PlaceDetail({
  place,
  onPerson,
}: {
  place: Place;
  onPerson: (person: Person) => void;
}) {
  const { peopleAtPlace } = useDirectory();
  const people = peopleAtPlace(place.id);
  const where = [
    place.address,
    `${districtPlace(place.district)} ${place.zip}`.trim(),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="px-5 py-4">
      <header className="flex items-start gap-3">
        <PlaceMark
          id={place.id}
          name={place.name}
          kind={place.kind}
          className="size-12"
        />
        <div className="min-w-0">
          <h2 className="text-lg leading-tight font-semibold tracking-tight text-ink">
            {place.name}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-3">
            {placeKindLabel(place.kind)} · {districtLabel(place.district)}
          </p>
        </div>
      </header>

      {place.why && (
        <p className="mt-4 text-sm leading-relaxed text-ink-2">{place.why}</p>
      )}

      <dl className="mt-4 grid gap-3">
        {place.schedule && (
          <Fact icon={<CalendarDays />} label="When">
            {place.schedule}
          </Fact>
        )}
        {place.venue && (
          <Fact icon={<Building2 />} label="Venue">
            {place.venue}
          </Fact>
        )}
        <Fact icon={<MapPin />} label="Where">
          {where || districtFull(place.district)}
        </Fact>
        {place.website && (
          <Fact icon={<Globe />} label="Website">
            <a
              href={`https://${place.website}`}
              target="_blank"
              rel="noreferrer"
              className="text-brand-2 underline-offset-2 hover:underline"
            >
              {place.website}
            </a>
          </Fact>
        )}
      </dl>

      {people.length > 0 && (
        <section className="mt-5">
          <h3 className="text-[0.75rem] font-medium tracking-wide text-ink-4 uppercase">
            People here
          </h3>
          <ul className="mt-2 grid gap-1">
            {people.map(({ person, role }) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => onPerson(person)}
                  className="flex w-full items-center gap-3 rounded-card px-2 py-1.5 text-left hover:bg-surface-2"
                >
                  <Monogram
                    name={person.name}
                    hue={person.hue}
                    round
                    className="size-8"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {person.name}
                    </span>
                    <span className="block truncate text-[0.75rem] text-ink-3">
                      {role || person.role}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {place.sources.length > 0 && (
        <section className="mt-6 border-t border-line pt-4">
          <h3 className="text-[0.75rem] font-medium tracking-wide text-ink-4 uppercase">
            Sources
          </h3>
          <ul className="mt-2 grid gap-1 text-[0.75rem]">
            {place.sources.map((url) => (
              <li key={url} className="truncate">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink-3 underline-offset-2 hover:text-ink hover:underline"
                >
                  {url.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
