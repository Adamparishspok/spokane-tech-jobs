# Spokane Tech Jobs

A directory and job board for the Spokane tech ecosystem, with a map as the
centrepiece. Standalone app on Neon Postgres — the data is real rows behind
row-level security, not a fixture file.

```
bun install
bun run dev          # http://localhost:5184
bun run typecheck
bun run db:push      # apply db/schema.sql
bun run db:load-real # load db/research/real-companies.json, clear the seed
bun run db:logos     # fetch each company's logo into public/logos
bun run db:export    # rebuild the open data, llms.txt and the static pages
bun run db:seed      # the prototype's demo directory, for a scratch branch
```

The database scripts read `.env.local`, which is gitignored and holds the Neon
connection string and the Data API URL — copy `.env.example` and fill it in. A
clone without it still runs, still draws the map and still renders every screen
— it just has nothing in it.

## Licences, and the data

The code is MIT (`LICENSE`). The directory itself — the companies, and the
exports built from them — is CC BY 4.0 (`LICENSE-DATA`): open, reusable, and
free to train on, with attribution.

Every row is sourced from public records, and `db/research/real-companies.json`
carries the source URLs for each one. A fact nobody has published is null rather
than estimated, which is why `headcount`, `founded`, `stage` and `workplace` are
all nullable and why the UI leaves out what it does not know.

**Corrections and additions are the most useful contribution.** A pull request
that adds a company, or fixes a field, with the public source it came from, is
exactly the shape this wants. `bun run db:export` regenerates `public/` — the
static page per company, the JSON, the sitemap and `llms.txt` — so what search
engines and answer engines see is always something visible in the diff.

## Where it came from

It began as `prototypes/ponderosa` in the atomparish-site repo: a build-out of
nineteen comps, redesigned rather than reproduced. This is that app with a
backend under it and its own history. The design system came along as a vendored
copy at `src/kit`, reached through the `@kit` alias, so it is this app's code now
rather than a workspace dependency.

## The shape of it

```
db/schema.sql       tables, views, RLS policies, grants
db/push.ts          applies the schema, statement by statement
db/seed.ts          the starting directory
src/domain.ts       the types and the formatting every screen shares
src/seed-data.ts    the content the seed script inserts
src/db/client.ts    the Neon client, and explain() for when it says no
src/db/auth.tsx     useViewer — the signed-in person, or null
src/db/directory.tsx  companies, jobs and people, fetched once and refreshed after writes
src/db/mutations.ts every write the product makes
src/db/mine.tsx     the viewer's own rows: saved jobs and claim requests
src/app/            the screens
src/map/            the basemap, the projection and Spokane's districts
src/design/         the theme and the specimen page
```

`/#specimen` is every token and primitive on one page, with the theme toggle —
the fastest way to see whether a change to the theme still holds together.

## The database is the design

Three decisions in `db/schema.sql` are load-bearing, and each is easy to undo by
accident.

**Expiry is a fact about time, not a column somebody updates.** The public reads
`live_jobs`, a view that applies the closing date, rather than a table with a
boolean somebody has to remember to flip. A query that forgets the filter cannot
be written, because the filter is not in the query.

**Anonymous readers, authenticated writers.** Reads are granted to everyone,
including the anonymous token the SDK issues to a visitor with no account.
Writes require a real session, and every policy compares the row's owner to
`auth.user_id()` — so a row claiming the wrong owner is refused by Postgres
rather than accepted quietly. A refusal arrives as `42501`, which `explain()`
turns into a sentence a person can act on.

**Claiming is a request, not an action.** No policy anywhere lets a user write
`claimed_by`. A claim inserts a row into `claims` that somebody reads by hand,
because the entire value of a claim is that a person checked it — one you can
grant yourself is a checkbox. The insert policy also refuses any `status` other
than `pending`, so the rule lives in the database rather than in the client that
an attacker gets to edit.

## What the viewer's own rows do

`src/db/mine.tsx` holds the two things scoped to the signed-in person: which
jobs they saved, and which listings they have asked to claim. Both are read back
from the database on sign-in rather than kept only in the component that wrote
them — a saved job that vanishes on reload is worse than one never offered — and
both empty on sign-out rather than showing the last person's.

Saving is optimistic: the bookmark fills on click and rolls back if the write is
refused, because a control that waits on a round trip reads as one that did not
work. Signed out, the bookmark and the claim button open the auth dialog instead
of failing at the policy and reporting an error nobody can act on.

A pending claim replaces the button with the state it is in. Offering it again
would invite the second ask a person makes when the first left no trace, and
`claims` is unique on `(company_id, user_id)`, so the second ask fails anyway.

## Verifying

`bun run typecheck` is the fast gate. `bun run shots` walks the app with
Playwright and writes `shots/out/`, failing loudly on any console or page error —
it was carried over from the prototype, so its walk covers the screens as they
were before the backend went in.
