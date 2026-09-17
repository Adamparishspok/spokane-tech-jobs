-- Spokane Tech Jobs — schema.
--
-- Applied with `bun run db:push`. Written to be re-runnable: every statement is
-- idempotent, so pushing twice is a no-op rather than an error.
--
-- The app is a client-only SPA talking to the Neon Data API (PostgREST) with
-- the signed-in user's JWT, which means **every access rule in this product is
-- an RLS policy in this file**. There is no server layer to put a forgotten
-- check in. Read it that way: if a policy is not here, the rule does not exist.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
-- Real enums rather than text + check: PostgREST exposes them as a closed set,
-- so a bad value fails at the edge instead of arriving as a row nobody's
-- filter will ever match.

do $$ begin
  create type workplace as enum ('On-site', 'Hybrid', 'Remote-first');
exception when duplicate_object then null; end $$;

do $$ begin
  create type funding_stage as enum (
    'Bootstrapped', 'Seed', 'Series A', 'Series B', 'Employee-owned', 'Private'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type employment as enum (
    'Full-time', 'Contract', 'Internship', 'Apprentice'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type seniority as enum ('Junior', 'Mid', 'Senior', 'Staff', 'Lead');
exception when duplicate_object then null; end $$;

do $$ begin
  create type discipline as enum (
    'Engineering', 'Design', 'Data', 'Product', 'Operations', 'Sales', 'Support'
  );
exception when duplicate_object then null; end $$;

-- Anything a member of the public can submit lands here first. A directory
-- that publishes on submit is a spam directory by the second week.
do $$ begin
  create type review_status as enum ('pending', 'published', 'rejected');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------ reference
-- Districts are the map's labels and the filter's values at once — one table,
-- because two lists of the same places would drift.

create table if not exists districts (
  id        text primary key,
  name      text not null,
  lng       double precision not null,
  lat       double precision not null,
  min_zoom  real not null default 12.4,
  sort      int  not null default 0
);

create table if not exists industries (
  id    text primary key,
  name  text not null,
  sort  int  not null default 0
);

-- ------------------------------------------------------------ companies

create table if not exists companies (
  id            text primary key,
  name          text not null,
  tagline       text not null,
  about         text not null default '',
  -- The monogram tile's hue. Stored rather than derived so a company that
  -- later uploads a real logo does not change colour on the way past.
  hue           int  not null default 200 check (hue between 0 and 359),
  industry_id   text not null references industries(id),
  -- Null where the fact is not public. A real directory is built from
  -- sourced rows, and a sourced row is routinely missing a headcount, a
  -- founding year or a funding stage — inventing a plausible number to
  -- satisfy a NOT NULL is how a directory stops being trustworthy.
  headcount     int  check (headcount > 0),
  founded       int  check (founded between 1850 and 2100),
  stage         funding_stage,
  -- Also null where unsourced: whether a company is on-site, hybrid or remote
  -- is rarely stated anywhere citable, and guessing it misdescribes the job
  -- somebody is deciding whether to apply for.
  workplace     workplace,
  district_id   text not null references districts(id),
  address       text not null default '',
  zip           text not null default '',
  lng           double precision not null,
  lat           double precision not null,
  website       text,
  email         text,
  phone         text,
  -- A path under /logos, written by db/fetch-logos.ts and served from this
  -- app rather than hot-linked: a marker that depends on a third party is a
  -- marker that disappears when the third party rate-limits us, and every
  -- reader's browser would be announcing to that third party which companies
  -- they are looking at.
  logo_url      text,
  -- Whoever proved they work here. Null is the honest default: most listings
  -- in a local directory are added by somebody else.
  claimed_by    text,
  claimed_at    timestamptz,
  status        review_status not null default 'pending',
  submitted_by  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists companies_status_idx on companies (status);
create index if not exists companies_district_idx on companies (district_id);
create index if not exists companies_claimed_idx on companies (claimed_by);

-- ----------------------------------------------------------------- jobs

create table if not exists jobs (
  id               uuid primary key default gen_random_uuid(),
  company_id       text not null references companies(id) on delete cascade,
  title            text not null,
  discipline       discipline not null,
  level            seniority not null,
  employment       employment not null default 'Full-time',
  workplace        workplace not null,
  -- Required, both of them. Washington law requires a range on a posting and
  -- a board that makes it optional is a board where nobody fills it in.
  pay_low          int not null check (pay_low > 0),
  pay_high         int not null check (pay_high > 0),
  hourly           boolean not null default false,
  summary          text not null default '',
  responsibilities text[] not null default '{}',
  requirements     text[] not null default '{}',
  apply_url        text,
  status           review_status not null default 'pending',
  posted_by        text,
  posted_at        timestamptz not null default now(),
  -- Listings expire. The alternative is a job board whose top result closed
  -- eighteen months ago, which is how local boards die.
  expires_at       timestamptz not null default now() + interval '60 days',
  constraint jobs_pay_range check (pay_high >= pay_low)
);

create index if not exists jobs_company_idx on jobs (company_id);
create index if not exists jobs_live_idx on jobs (status, expires_at);

-- --------------------------------------------------------------- people
--
-- A person here is not necessarily a user. The directory was seeded with
-- people who have never signed in, and a real signup claims a row by id. That
-- is why `user_id` is nullable and separate from the primary key: making the
-- user id the key would have meant either inventing fake auth rows for the
-- seed or throwing the seed away.

create table if not exists people (
  id          text primary key,
  user_id     text unique,
  name        text not null,
  hue         int  not null default 200 check (hue between 0 and 359),
  role        text not null default '',
  company_id  text references companies(id) on delete set null,
  district_id text references districts(id),
  open_to     boolean not null default false,
  skills      text[] not null default '{}',
  bio         text not null default '',
  years       int not null default 0 check (years >= 0),
  -- Listed in the People tab at all. Someone can hold an account without
  -- appearing in a public directory of who works where.
  listed      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists people_company_idx on people (company_id);
create index if not exists people_open_idx on people (open_to) where listed;

-- ----------------------------------------------------------- saved jobs

create table if not exists saved_jobs (
  user_id   text not null,
  job_id    uuid not null references jobs(id) on delete cascade,
  saved_at  timestamptz not null default now(),
  primary key (user_id, job_id)
);

-- The three facts above were NOT NULL in the first cut of this schema, when
-- the only rows were the prototype's invented ones and every field could be
-- filled in. Dropping the constraint is what lets a sourced company land with
-- the gaps its sources actually have.
alter table companies alter column headcount drop not null;
alter table companies alter column founded   drop not null;
alter table companies alter column stage     drop not null;
alter table companies alter column workplace drop not null;
alter table companies add column if not exists logo_url text;

-- ------------------------------------------------------------ claims
-- Claiming a listing is a request, not an action. Approving it is the one
-- thing in this product that cannot be self-serve: the whole point is that
-- somebody checks the person works there.

create table if not exists claims (
  id          uuid primary key default gen_random_uuid(),
  company_id  text not null references companies(id) on delete cascade,
  user_id     text not null,
  work_email  text not null,
  note        text not null default '',
  status      review_status not null default 'pending',
  created_at  timestamptz not null default now(),
  unique (company_id, user_id)
);

-- --------------------------------------------------------------- views
--
-- `live_*` is what the public reads. Expiry is a fact about time, not a column
-- somebody remembers to update, so it is applied here rather than in every
-- query the client makes — and therefore cannot be forgotten in one of them.

create or replace view live_jobs as
  select j.*
  from jobs j
  join companies c on c.id = j.company_id
  where j.status = 'published'
    and j.expires_at > now()
    and c.status = 'published';

create or replace view company_open_roles as
  select c.id as company_id, count(j.id)::int as open_roles
  from companies c
  left join live_jobs j on j.company_id = c.id
  where c.status = 'published'
  group by c.id;

-- ------------------------------------------------------- updated_at

create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists companies_touch on companies;
create trigger companies_touch before update on companies
  for each row execute function touch_updated_at();

drop trigger if exists people_touch on people;
create trigger people_touch before update on people
  for each row execute function touch_updated_at();

-- ==================================================================== RLS
--
-- Everything below is the access model. There is no server in front of this,
-- so these policies are not defence in depth — they are the defence.
--
-- `auth.user_id()` is the sub claim of the Neon Auth JWT the Data API
-- verified. It is null for an anonymous reader, which is why every owner
-- policy compares against it directly rather than testing a role name: a null
-- never equals a stored id, so an anonymous request matches no owner row.
--
-- The signed-out role is `anonymous`, not `anon`. PostgREST's own convention
-- is `anon` and Neon's is not; a policy granted to `anon` fails outright with
-- "role does not exist", which is at least a loud way to find out.

alter table districts   enable row level security;
alter table industries  enable row level security;
alter table companies   enable row level security;
alter table jobs        enable row level security;
alter table people      enable row level security;
alter table saved_jobs  enable row level security;
alter table claims      enable row level security;

-- Reference data is public and read-only. Nobody adds a district.
drop policy if exists districts_read on districts;
create policy districts_read on districts for select to anonymous, authenticated using (true);

drop policy if exists industries_read on industries;
create policy industries_read on industries for select to anonymous, authenticated using (true);

-- --- companies -----------------------------------------------------------

-- Anyone may read a published listing. Nobody may read a pending one, which
-- is what keeps the moderation queue from being a public preview of spam.
drop policy if exists companies_read_published on companies;
create policy companies_read_published on companies
  for select to anonymous, authenticated
  using (status = 'published');

-- You can always see what you submitted, so a submission does not vanish.
drop policy if exists companies_read_own_submission on companies;
create policy companies_read_own_submission on companies
  for select to authenticated
  using (submitted_by = auth.user_id());

-- Signed-in users may submit. `with check` pins the two columns a submitter
-- must not choose for themselves: the status, and whose submission it is.
drop policy if exists companies_insert on companies;
create policy companies_insert on companies
  for insert to authenticated
  with check (
    submitted_by = auth.user_id()
    and status = 'pending'
    and claimed_by is null
  );

-- Only whoever claimed the listing can edit it, and they cannot use an edit to
-- publish themselves, hand the listing to somebody else, or take it back off
-- the map.
drop policy if exists companies_update_claimed on companies;
create policy companies_update_claimed on companies
  for update to authenticated
  using (claimed_by = auth.user_id() and status = 'published')
  with check (claimed_by = auth.user_id() and status = 'published');

-- --- jobs ----------------------------------------------------------------

drop policy if exists jobs_read_published on jobs;
create policy jobs_read_published on jobs
  for select to anonymous, authenticated
  using (
    status = 'published'
    and expires_at > now()
    and exists (
      select 1 from companies c
      where c.id = jobs.company_id and c.status = 'published'
    )
  );

drop policy if exists jobs_read_own on jobs;
create policy jobs_read_own on jobs
  for select to authenticated
  using (posted_by = auth.user_id());

-- A job can only be posted against a company you have claimed. This is the
-- rule that stops the board filling with roles at companies the poster has
-- nothing to do with, and it is enforceable here precisely because claiming is
-- reviewed by a human.
drop policy if exists jobs_insert_claimed on jobs;
create policy jobs_insert_claimed on jobs
  for insert to authenticated
  with check (
    posted_by = auth.user_id()
    and status = 'pending'
    and exists (
      select 1 from companies c
      where c.id = jobs.company_id and c.claimed_by = auth.user_id()
    )
  );

drop policy if exists jobs_update_own on jobs;
create policy jobs_update_own on jobs
  for update to authenticated
  using (posted_by = auth.user_id())
  with check (posted_by = auth.user_id());

-- Taking your own listing down is allowed and not reviewed. Making one appear
-- is the direction that needs a check.
drop policy if exists jobs_delete_own on jobs;
create policy jobs_delete_own on jobs
  for delete to authenticated
  using (posted_by = auth.user_id());

-- --- people --------------------------------------------------------------

drop policy if exists people_read_listed on people;
create policy people_read_listed on people
  for select to anonymous, authenticated
  using (listed = true);

drop policy if exists people_read_self on people;
create policy people_read_self on people
  for select to authenticated
  using (user_id = auth.user_id());

drop policy if exists people_insert_self on people;
create policy people_insert_self on people
  for insert to authenticated
  with check (user_id = auth.user_id());

drop policy if exists people_update_self on people;
create policy people_update_self on people
  for update to authenticated
  using (user_id = auth.user_id())
  with check (user_id = auth.user_id());

-- Delisting yourself is a delete. Nobody should need to email anyone to get
-- their name off a directory they never asked to be on.
drop policy if exists people_delete_self on people;
create policy people_delete_self on people
  for delete to authenticated
  using (user_id = auth.user_id());

-- --- saved jobs ----------------------------------------------------------
-- Private to the person. Not "readable by the company" in any direction — who
-- saved a job is the single most sensitive row in this schema.

drop policy if exists saved_all_own on saved_jobs;
create policy saved_all_own on saved_jobs
  for all to authenticated
  using (user_id = auth.user_id())
  with check (user_id = auth.user_id());

-- --- claims --------------------------------------------------------------

drop policy if exists claims_read_own on claims;
create policy claims_read_own on claims
  for select to authenticated
  using (user_id = auth.user_id());

drop policy if exists claims_insert_own on claims;
create policy claims_insert_own on claims
  for insert to authenticated
  with check (user_id = auth.user_id() and status = 'pending');

-- ------------------------------------------------------------- grants
-- PostgREST can only expose what the role can reach. Read for everyone,
-- writes only for a verified session — and the policies above narrow both.

grant usage on schema public to anonymous, authenticated;

grant select on districts, industries, companies, jobs, people to anonymous, authenticated;
grant select on live_jobs, company_open_roles to anonymous, authenticated;

grant insert, update on companies to authenticated;
grant insert, update, delete on jobs to authenticated;
grant insert, update, delete on people to authenticated;
grant select, insert, delete on saved_jobs to authenticated;
grant select, insert on claims to authenticated;
