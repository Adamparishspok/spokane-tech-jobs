import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FieldRow,
  Input,
  Label,
  Textarea,
  Separator,
  Switch,
} from "@kit/ui";
import { MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DISCIPLINES,
  EMPLOYMENTS,
  STAGES,
  LEVELS,
  WORKPLACES,
  hueFor,
  type Company,
  type Discipline,
  type Employment,
  type Level,
  type Workplace,
} from "../domain";
import { useViewer } from "../db/auth";
import { explain } from "../db/client";
import { useDirectory } from "../db/directory";
import {
  addCompany,
  listIndustries,
  postJob,
  requestClaim,
  saveProfile,
} from "../db/mutations";
import { Basemap } from "../map/basemap";
import { DISTRICTS, type DistrictId } from "../map/spokane";
import { Monogram } from "../design/brand";

/**
 * The two forms that put something into the directory, and the profile.
 *
 * The comps' forms are the clearest single failure in the set: every field on
 * every one of them — Company Name, Address, Industry, Website, Phone, and
 * both halves of the sign-in form — carries the placeholder "Link to apply".
 * A password field whose placeholder says "Link to apply" is not a
 * placeholder problem, it is a form nobody read back.
 *
 * So every field below has a real label, a real placeholder that shows the
 * shape of the answer, and a real hint where the answer is not obvious. Two
 * things beyond that are worth the extra work:
 *
 * - **The address is a map.** This is a map product; a company's location is
 *   its most important field and the comps made it a text input like any
 *   other. Picking a district moves a pin on a live preview drawn with the
 *   same basemap as the main screen.
 *
 * - **Pay is required.** A job board that lets a listing omit it produces a
 *   board where nobody posts it. It is the field candidates filter on first
 *   and the only one that is genuinely hard to ask for, so the form asks.
 */

function Sheetish({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  onSubmit,
  busy,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  onSubmit: (data: FormData) => void;
  busy?: boolean;
  error?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[86dvh] w-[34rem] flex-col overflow-hidden p-0">
        {/* A real form, so Enter submits, a browser can autofill it, and the
            fields are read by name at submit rather than mirrored into a
            useState each. The uncontrolled version is not a shortcut here — it
            is the reason a password manager and the browser's own autofill
            work on the company form at all. */}
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            onSubmit(new FormData(e.currentTarget));
          }}
        >
          <DialogHeader className="shrink-0 border-b border-line px-5 pt-5 pb-4">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {children}
          </div>

          {error && (
            <p
              role="alert"
              className="shrink-0 border-t border-danger/25 bg-danger-soft px-5 py-2.5 text-[0.8125rem] text-danger"
            >
              {error}
            </p>
          )}

          <div className="flex shrink-0 items-center gap-2 border-t border-line px-5 py-3">
            {footer}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What a submitted form does next.
 *
 * All three forms share it because they share the shape: write, refresh the
 * directory so the result is visible where it landed, close. The interesting
 * part is the failure path — a PostgREST error here is usually an RLS policy
 * saying no, and "Failed to fetch" is not a sentence anybody can act on, so
 * the message is translated at the one place every write passes through.
 */
function useSubmit(onDone: () => void) {
  const { refresh } = useDirectory();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      refresh();
      onDone();
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, run, setError };
}

/** One field out of a FormData, trimmed, never undefined. */
const str = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

/** One textarea of newline-separated bullets, blanks dropped. */
const lines = (data: FormData, key: string) =>
  str(data, key)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * The industries table, fetched once per session.
 *
 * The interface needs the display name and the database needs the id, and
 * hard-coding the pairing in the client is how the two drift the first time
 * somebody adds an industry in SQL.
 */
function useIndustries() {
  const [industries, setIndustries] = useState<{ id: string; name: string }[]>(
    [],
  );
  useEffect(() => {
    let live = true;
    listIndustries()
      .then((rows) => live && setIndustries(rows))
      .catch(() => live && setIndustries([]));
    return () => {
      live = false;
    };
  }, []);
  return industries;
}

/**
 * The district picker.
 *
 * A select would have done. This is the screen where a person is deciding
 * whether their company belongs in a Spokane directory at all, and showing
 * them their own pin land on the river is worth more than the twenty lines it
 * costs.
 */
function DistrictField({
  value,
  onChange,
}: {
  value: DistrictId;
  onChange: (id: DistrictId) => void;
}) {
  const district = DISTRICTS.find((d) => d.id === value) ?? DISTRICTS[0];
  const camera = useMemo(
    () => ({ center: district.at, zoom: 13.4 }),
    [district],
  );

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="district">District</Label>
      <select
        id="district"
        name="district"
        value={value}
        onChange={(e) => onChange(e.target.value as DistrictId)}
        className="h-[2.125rem] w-full rounded-field border border-line-2 bg-field px-3 text-sm text-ink outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15"
      >
        {DISTRICTS.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <div className="relative mt-1 h-36 overflow-hidden rounded-card border border-line-2">
        <Basemap camera={camera} size={{ width: 470, height: 144 }} />
        <span className="absolute top-1/2 left-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-surface bg-hiring text-white shadow-[var(--shadow-marker)]">
          <MapPin className="size-3.5" />
        </span>
      </div>
      <p className="text-[0.8125rem] text-ink-3">
        Roughly where the office is. The exact address goes above; this is what
        puts you on the map.
      </p>
    </div>
  );
}

export function AddCompany({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const viewer = useViewer();
  const [name, setName] = useState("");
  const [district, setDistrict] = useState<DistrictId>("downtown");
  const [workplace, setWorkplace] = useState<Workplace>("Hybrid");
  const [headcount, setHeadcount] = useState("");
  const industries = useIndustries();
  const { busy, error, run } = useSubmit(() => {
    setName("");
    onOpenChange(false);
  });

  const submit = (data: FormData) => {
    if (!viewer) return;
    const at = DISTRICTS.find((d) => d.id === district) ?? DISTRICTS[0];
    run(async () => {
      await addCompany(
        {
          name: name.trim(),
          tagline: str(data, "company-tagline"),
          about: str(data, "company-about"),
          hue: hueFor(name),
          industryId: str(data, "company-industry"),
          headcount: Number(headcount) || 1,
          founded:
            Number(str(data, "company-founded")) || new Date().getFullYear(),
          stage: str(data, "company-stage") || "Bootstrapped",
          workplace,
          district,
          address: str(data, "company-address"),
          zip: str(data, "company-zip"),
          /* The district centre is the location until somebody geocodes the
             street address. It is the honest resolution of what was actually
             collected: a pin on the right neighbourhood rather than a
             precise-looking pin on the wrong building. */
          lng: at.at.lng,
          lat: at.at.lat,
          website: str(data, "company-website"),
          email: str(data, "company-email"),
          phone: str(data, "company-phone"),
        },
        viewer.id,
      );
    });
  };

  return (
    <Sheetish
      open={open}
      onOpenChange={onOpenChange}
      title="Add a company"
      description="Anyone can add a company. Someone who works there can claim it later."
      onSubmit={submit}
      busy={busy}
      error={error}
      footer={
        <>
          <p className="text-[0.8125rem] text-ink-3">
            Reviewed before it appears — usually within a day.
          </p>
          <div className="ml-auto flex gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="accent"
              disabled={!name.trim() || busy}
            >
              {busy ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="flex items-center gap-3">
          <Monogram
            name={name || "New company"}
            hue={hueFor(name || "New company")}
            className="size-12 text-base"
          />
          <div className="text-[0.8125rem] text-ink-3">
            <p className="font-medium text-ink-2">Logo</p>
            <p>
              Optional. Until one is uploaded the listing uses initials, which
              is what you are looking at.
            </p>
          </div>
        </div>

        <Separator />

        <FieldRow label="Company name" htmlFor="company-name">
          <Input
            id="company-name"
            name="company-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Latah Systems"
            autoComplete="organization"
          />
        </FieldRow>

        <FieldRow
          label="What it does"
          htmlFor="company-tagline"
          hint="One line. It is what shows in the list beside the name."
        >
          <Input
            id="company-tagline"
            name="company-tagline"
            placeholder="Scheduling for rural hospital networks"
            maxLength={70}
          />
        </FieldRow>

        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <FieldRow label="Street address" htmlFor="company-address">
            <Input
              id="company-address"
              name="company-address"
              placeholder="601 W Riverside Ave, Suite 1400"
              autoComplete="street-address"
            />
          </FieldRow>
          <FieldRow label="ZIP" htmlFor="company-zip">
            <Input
              id="company-zip"
              name="company-zip"
              placeholder="99201"
              inputMode="numeric"
              autoComplete="postal-code"
              className="num"
            />
          </FieldRow>
        </div>

        <DistrictField value={district} onChange={setDistrict} />

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="People" htmlFor="company-headcount">
            <Input
              id="company-headcount"
              name="company-headcount"
              type="number"
              inputMode="numeric"
              min={1}
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
              placeholder="24"
              className="num"
            />
          </FieldRow>
          <FieldRow label="Founded" htmlFor="company-founded">
            <Input
              id="company-founded"
              name="company-founded"
              type="number"
              inputMode="numeric"
              min={1850}
              max={new Date().getFullYear()}
              placeholder="2019"
              className="num"
            />
          </FieldRow>
        </div>

        <FieldRow label="Stage" htmlFor="company-stage">
          <select
            id="company-stage"
            name="company-stage"
            className="h-[2.125rem] w-full rounded-field border border-line-2 bg-field px-3 text-sm text-ink outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15"
            defaultValue="Bootstrapped"
          >
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Industry" htmlFor="company-industry">
          <select
            id="company-industry"
            name="company-industry"
            className="h-[2.125rem] w-full rounded-field border border-line-2 bg-field px-3 text-sm text-ink outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15"
            defaultValue=""
          >
            <option value="" disabled>
              Choose one
            </option>
            {industries.map((industry) => (
              <option key={industry.id} value={industry.id}>
                {industry.name}
              </option>
            ))}
          </select>
        </FieldRow>

        <div className="grid gap-1.5">
          <Label>How the team works</Label>
          <div className="flex gap-1.5">
            {WORKPLACES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setWorkplace(option)}
                aria-pressed={workplace === option}
                className={
                  workplace === option
                    ? "h-8 flex-1 rounded-field border border-brand/35 bg-brand-faint text-[0.8125rem] font-medium text-brand-deep"
                    : "h-8 flex-1 rounded-field border border-line-2 bg-surface text-[0.8125rem] font-medium text-ink-2 hover:bg-surface-2"
                }
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Website" htmlFor="company-website">
            <Input
              id="company-website"
              name="company-website"
              type="url"
              placeholder="latahsystems.com"
              autoComplete="url"
            />
          </FieldRow>
          <FieldRow label="Contact email" htmlFor="company-email">
            <Input
              id="company-email"
              name="company-email"
              type="email"
              placeholder="careers@latahsystems.com"
              autoComplete="email"
            />
          </FieldRow>
        </div>

        <FieldRow
          label="About"
          htmlFor="company-about"
          hint="A short paragraph. What the company builds and who for."
        >
          <Textarea
            id="company-about"
            name="company-about"
            rows={4}
            placeholder="Latah builds the scheduling layer that sits between a critical-access hospital and the specialists it borrows from…"
          />
        </FieldRow>
      </div>
    </Sheetish>
  );
}

export function PostJob({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const viewer = useViewer();
  const { companies } = useDirectory();
  const [title, setTitle] = useState("");
  const [discipline, setDiscipline] = useState<Discipline | "">("");
  const [hourly, setHourly] = useState(false);
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const { busy, error, run } = useSubmit(() => {
    setTitle("");
    setDiscipline("");
    setLow("");
    setHigh("");
    onOpenChange(false);
  });

  /**
   * Only companies this person has claimed.
   *
   * The same rule is enforced by `jobs_insert_claimed` in the schema, so this
   * select is not the check — it is the courtesy. Offering every company in
   * the dropdown and then failing the insert would be a form that invites you
   * to do something the database will refuse.
   */
  const mine = useMemo(
    () => companies.filter((c) => viewer && c.claimedBy === viewer.id),
    [companies, viewer],
  );

  const payOk =
    low.trim() !== "" && high.trim() !== "" && Number(high) >= Number(low);
  const canPost =
    title.trim() !== "" && discipline !== "" && payOk && mine.length > 0;

  const submit = (data: FormData) => {
    if (!viewer || !discipline) return;
    run(() =>
      postJob(
        {
          companyId: str(data, "job-company"),
          title: title.trim(),
          discipline,
          level: (str(data, "job-level") || "Mid") as Level,
          employment: (str(data, "job-employment") ||
            "Full-time") as Employment,
          workplace: (str(data, "job-workplace") || "Hybrid") as Workplace,
          payLow: Number(low),
          payHigh: Number(high),
          hourly,
          summary: str(data, "job-summary"),
          responsibilities: lines(data, "job-responsibilities"),
          requirements: lines(data, "job-requirements"),
          applyUrl: str(data, "job-apply"),
        },
        viewer.id,
      ),
    );
  };

  return (
    <Sheetish
      open={open}
      onOpenChange={onOpenChange}
      title="Post a job"
      description="Free for companies you have claimed. Listings expire after 60 days."
      onSubmit={submit}
      busy={busy}
      error={error}
      footer={
        <>
          <p className="text-[0.8125rem] text-ink-3">
            {mine.length === 0
              ? "Claim a company first."
              : canPost
                ? "Ready to post."
                : "Pay range is required."}
          </p>
          <div className="ml-auto flex gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={!canPost || busy}>
              {busy ? "Posting…" : "Post listing"}
            </Button>
          </div>
        </>
      }
    >
      <div className="grid gap-4">
        {mine.length === 0 ? (
          <p className="rounded-card border border-line-2 bg-surface-2 px-3 py-2.5 text-[0.8125rem] leading-relaxed text-ink-2">
            You have not claimed a company yet. Open a company on the map and
            claim its listing — once that is approved, its roles can be posted
            from here.
          </p>
        ) : (
          <FieldRow label="Company" htmlFor="job-company">
            <select
              id="job-company"
              name="job-company"
              className="h-[2.125rem] w-full rounded-field border border-line-2 bg-field px-3 text-sm text-ink outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15"
            >
              {mine.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FieldRow>
        )}

        <FieldRow
          label="Job title"
          htmlFor="job-title"
          hint="What the role is called internally, not what it is called in a req."
        >
          <Input
            id="job-title"
            name="job-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Senior Backend Engineer, Scheduling"
          />
        </FieldRow>

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Discipline" htmlFor="job-discipline">
            <select
              id="job-discipline"
              name="job-discipline"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value as Discipline)}
              className="h-[2.125rem] w-full rounded-field border border-line-2 bg-field px-3 text-sm text-ink outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15"
            >
              <option value="" disabled>
                Choose one
              </option>
              {DISCIPLINES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Workplace" htmlFor="job-workplace">
            <select
              id="job-workplace"
              name="job-workplace"
              className="h-[2.125rem] w-full rounded-field border border-line-2 bg-field px-3 text-sm text-ink outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15"
              defaultValue="Hybrid"
            >
              {WORKPLACES.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </FieldRow>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Level" htmlFor="job-level">
            <select
              id="job-level"
              name="job-level"
              className="h-[2.125rem] w-full rounded-field border border-line-2 bg-field px-3 text-sm text-ink outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15"
              defaultValue="Mid"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Type" htmlFor="job-employment">
            <select
              id="job-employment"
              name="job-employment"
              className="h-[2.125rem] w-full rounded-field border border-line-2 bg-field px-3 text-sm text-ink outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15"
              defaultValue="Full-time"
            >
              {EMPLOYMENTS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </FieldRow>
        </div>

        <Separator />

        {/* The required field. A board that makes this optional becomes a board
            where nobody fills it in, and then it is a board nobody trusts. */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="job-pay-low">Pay range</Label>
            <label className="flex items-center gap-2 text-[0.8125rem] text-ink-3">
              Hourly
              <Switch
                checked={hourly}
                onCheckedChange={setHourly}
                aria-label="Quote this role hourly"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-4">
                $
              </span>
              <Input
                id="job-pay-low"
                name="job-pay-low"
                type="number"
                inputMode="numeric"
                value={low}
                onChange={(e) => setLow(e.target.value)}
                placeholder={hourly ? "27" : "145000"}
                className="num pl-6"
              />
            </div>
            <span className="text-sm text-ink-4">to</span>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-4">
                $
              </span>
              <Input
                type="number"
                inputMode="numeric"
                value={high}
                onChange={(e) => setHigh(e.target.value)}
                placeholder={hourly ? "36" : "178000"}
                aria-label="Maximum pay"
                className="num pl-6"
              />
            </div>
          </div>
          <p className="text-[0.8125rem] text-ink-3">
            {low && high && Number(high) < Number(low)
              ? "The top of the range is below the bottom of it."
              : "Required, and shown on the listing. Washington law requires it anyway."}
          </p>
        </div>

        <Separator />

        <FieldRow
          label="The role in a sentence"
          htmlFor="job-summary"
          hint="This is what shows in the list. Say the actual work, not the mission."
        >
          <Textarea
            id="job-summary"
            name="job-summary"
            rows={2}
            maxLength={200}
            placeholder="Own the constraint solver that decides which specialist can be where, and when."
          />
        </FieldRow>

        <FieldRow
          label="What they would do"
          htmlFor="job-responsibilities"
          hint="One per line. Three or four is plenty."
        >
          <Textarea
            id="job-responsibilities"
            name="job-responsibilities"
            rows={4}
            placeholder={
              "Extend the scheduling engine as new facility types come on\nCut the referral round trip to something a clerk will wait for\nCarry the on-call pager one week in six"
            }
          />
        </FieldRow>

        <FieldRow
          label="What you are looking for"
          htmlFor="job-requirements"
          hint="One per line. Mark the ones that are genuinely required."
        >
          <Textarea
            id="job-requirements"
            name="job-requirements"
            rows={4}
            placeholder={
              "Five years or more on a backend other people depend on\nComfortable reasoning about a solver you did not write\nHL7 or FHIR is useful and not required"
            }
          />
        </FieldRow>

        <FieldRow
          label="Where to apply"
          htmlFor="job-apply"
          hint="A link or an email address. This is the one field the old form named correctly."
        >
          <Input
            id="job-apply"
            name="job-apply"
            placeholder="https://latahsystems.com/careers/backend or careers@latahsystems.com"
          />
        </FieldRow>
      </div>
    </Sheetish>
  );
}

export function EditProfile({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const viewer = useViewer();
  const { companies, people } = useDirectory();
  /* The row this account already owns, if it has one. Editing a profile and
     creating one are the same form — the difference is whether the fields
     arrive filled in. */
  const mine = useMemo(
    () => people.find((p) => viewer && p.userId === viewer.id) ?? null,
    [people, viewer],
  );
  const [openTo, setOpenTo] = useState(mine?.openTo ?? false);
  const [district, setDistrict] = useState<DistrictId>(
    mine?.district ?? "downtown",
  );
  const { busy, error, run } = useSubmit(() => onOpenChange(false));

  /* The form is uncontrolled, so it reads its defaults once at mount. Keying
     the two switches to the loaded row is how they end up showing what is
     actually stored rather than what was stored the first time the dialog
     mounted. */
  useEffect(() => {
    if (!mine) return;
    setOpenTo(mine.openTo);
    setDistrict(mine.district);
  }, [mine]);

  const submit = (data: FormData) => {
    if (!viewer) return;
    const name = [str(data, "profile-first"), str(data, "profile-last")]
      .filter(Boolean)
      .join(" ");
    run(() =>
      saveProfile(
        {
          name: name || viewer.name,
          role: str(data, "profile-role"),
          hue: viewer.hue,
          companyId: str(data, "profile-company") || null,
          district,
          openTo,
          skills: str(data, "profile-skills")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          bio: str(data, "profile-bio"),
          years: Number(str(data, "profile-years")) || 0,
          listed: true,
        },
        viewer.id,
      ),
    );
  };

  if (!viewer) return null;

  return (
    <Sheetish
      open={open}
      onOpenChange={onOpenChange}
      title="Your profile"
      description="What other people in the directory see. Nothing here is required."
      onSubmit={submit}
      busy={busy}
      error={error}
      footer={
        <>
          <p className="text-[0.8125rem] text-ink-3">
            {openTo
              ? "Listed as open to work."
              : "Listed, but not shown as looking."}
          </p>
          <div className="ml-auto flex gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="flex items-center gap-3">
          <Monogram
            name={mine?.name ?? viewer.name}
            hue={viewer.hue}
            round
            className="size-12 text-base"
          />
          <div className="text-[0.8125rem] text-ink-3">
            <p className="font-medium text-ink-2">Photo</p>
            <p>Optional, like everything else here.</p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="First name" htmlFor="profile-first">
            <Input
              id="profile-first"
              name="profile-first"
              defaultValue={(mine?.name ?? viewer.name).split(" ")[0]}
              autoComplete="given-name"
            />
          </FieldRow>
          <FieldRow label="Last name" htmlFor="profile-last">
            <Input
              id="profile-last"
              name="profile-last"
              defaultValue={(mine?.name ?? viewer.name)
                .split(" ")
                .slice(1)
                .join(" ")}
              autoComplete="family-name"
            />
          </FieldRow>
        </div>

        <FieldRow label="What you do" htmlFor="profile-role">
          <Input
            id="profile-role"
            name="profile-role"
            defaultValue={mine?.role ?? ""}
            placeholder="Product Designer"
            autoComplete="organization-title"
          />
        </FieldRow>

        <FieldRow
          label="Where you work"
          htmlFor="profile-company"
          hint="Leave it blank if you are between things. That is a real answer here."
        >
          <select
            id="profile-company"
            name="profile-company"
            className="h-[2.125rem] w-full rounded-field border border-line-2 bg-field px-3 text-sm text-ink outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15"
            defaultValue={mine?.companyId ?? ""}
          >
            <option value="">Not currently working</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Email" htmlFor="profile-email">
          <Input
            id="profile-email"
            name="profile-email"
            type="email"
            defaultValue={viewer.email}
            autoComplete="email"
          />
        </FieldRow>

        {/* The comps put a job-listing placeholder in the personal bio field —
            "Copy and paste from an existing job listing (on the web or from a
            Word or Google Doc)" — under the label BIO. */}
        <FieldRow
          label="Bio"
          htmlFor="profile-bio"
          hint="A couple of sentences. What you have worked on, and what you would like to work on."
        >
          <Textarea
            id="profile-bio"
            name="profile-bio"
            rows={4}
            placeholder="Six years designing internal tools for people who did not choose the software…"
          />
        </FieldRow>

        <FieldRow
          label="Skills"
          htmlFor="profile-skills"
          hint="Comma separated. These are what people search on."
        >
          <Input
            id="profile-skills"
            name="profile-skills"
            placeholder="Product design, Design systems, Research"
          />
        </FieldRow>

        <Separator />

        <label className="flex items-start gap-3 rounded-card border border-line-2 bg-surface-2 p-3">
          <Switch
            checked={openTo}
            onCheckedChange={setOpenTo}
            className="mt-0.5"
          />
          <span className="text-[0.8125rem]">
            <span className="block font-medium text-ink">Open to work</span>
            <span className="block text-ink-3">
              Adds a badge to your row and puts you at the top of the People
              tab. Your current employer can see it, like everyone else.
            </span>
          </span>
        </label>
      </div>
    </Sheetish>
  );
}

/**
 * Claiming a listing.
 *
 * A request, not an action. No policy in `db/schema.sql` lets anybody write
 * `claimed_by` — this form can only add a row somebody else reads — so the
 * button it sits behind says "Request claim" rather than "Claim", and the
 * screen it returns to says the request is pending rather than pretending it
 * landed.
 *
 * The work email is the entire evidence, so it is the one required field. It
 * defaults to the address the account was created with: a person who signed up
 * with their work address should not have to type it twice, and one who did
 * not needs to see that this particular field wants the other one.
 */
export function ClaimListing({
  company,
  open,
  onOpenChange,
  onSubmitted,
}: {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const viewer = useViewer();
  const { busy, error, run } = useSubmit(() => onOpenChange(false));

  /* The bare host, so the hint names the domain the address should be at
     rather than reprinting the whole URL with its scheme. */
  const host = company.website.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  const submit = (data: FormData) => {
    if (!viewer) return;
    run(async () => {
      await requestClaim(
        company.id,
        str(data, "claim-email"),
        str(data, "claim-note"),
        viewer.id,
      );
      onSubmitted();
    });
  };

  return (
    <Sheetish
      open={open}
      onOpenChange={onOpenChange}
      title={`Claim ${company.name}`}
      description="Tell us how to check you work there. Someone reads this by hand."
      onSubmit={submit}
      busy={busy}
      error={error}
      footer={
        <>
          <p className="text-[0.8125rem] text-ink-3">
            Reviewed by a person — usually within a day.
          </p>
          <div className="ml-auto flex gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={busy}>
              {busy ? "Sending…" : "Request claim"}
            </Button>
          </div>
        </>
      }
    >
      <div className="grid gap-4">
        <FieldRow
          label="Work email"
          htmlFor="claim-email"
          hint={`An address at ${host} is what makes this checkable.`}
        >
          <Input
            id="claim-email"
            name="claim-email"
            type="email"
            required
            defaultValue={viewer?.email ?? ""}
            placeholder={`you@${host}`}
            autoComplete="email"
          />
        </FieldRow>

        <FieldRow
          label="Anything that helps"
          htmlFor="claim-note"
          hint="Optional. A title, or where to find you on the site."
        >
          <Textarea
            id="claim-note"
            name="claim-note"
            rows={3}
            placeholder="I run engineering here — I am on the team page."
          />
        </FieldRow>
      </div>
    </Sheetish>
  );
}
