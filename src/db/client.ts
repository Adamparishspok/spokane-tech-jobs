import { createClient } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

/**
 * The backend, in one object.
 *
 * There is no server. The browser talks to the Neon Data API directly and
 * every access rule in the product is an RLS policy in `db/schema.sql` — so
 * this file is small on purpose, and the schema is where the security review
 * belongs.
 *
 * `allowAnonymous` is the load-bearing option. The Data API requires a JWT on
 * every request, including from signed-out readers, and without this the SDK
 * has none to send: a public directory would answer 400 to everybody who has
 * not made an account. With it, the SDK fetches a short-lived anonymous token
 * on the first query and the `anonymous` Postgres role takes over — which is
 * exactly the role the `select` policies grant to.
 *
 * That is also why this app uses Neon's Managed Better Auth rather than a
 * third-party provider: anonymous tokens are the difference between a
 * directory anybody can look things up in and one that demands a signup before
 * showing a single company.
 */

const url = import.meta.env.VITE_NEON_DATABASE_URL as string | undefined;

/**
 * Whether this build has a backend at all.
 *
 * It can legitimately not: a clone with no `.env.local` still runs, still
 * draws the map, and says plainly that it is not connected rather than
 * throwing on the first fetch. That matters more here than usual, because the
 * map is most of the product and needs nothing from the database.
 */
export const hasBackend = Boolean(url);

export const neon = url
  ? createClient(url, {
      auth: {
        allowAnonymous: true,
        /* `BetterAuthReactAdapter()` returns a builder that createClient calls
           with the derived auth URL, but the string-URL overload is typed as
           wanting the built instance. The cast is to that mismatch in the beta
           SDK's own types and nothing else — narrowed to this one expression so
           it disappears the moment the signature is fixed. */
        adapter: BetterAuthReactAdapter() as unknown as Parameters<
          typeof createClient
        >[1] extends { auth: { adapter: infer A } }
          ? A
          : never,
      },
    })
  : null;

/** Narrowed accessor, so callers do not each re-check the null. */
export function db() {
  if (!neon) throw new Error("No Neon database configured");
  return neon;
}

/**
 * Turn whatever came back into a sentence.
 *
 * A PostgREST refusal is usually an RLS policy saying no, and "Failed to
 * fetch" is not something a person can act on. Translated at the one place
 * every read and write passes through.
 */
export function explain(error: unknown): string {
  if (!error) return "Something went wrong.";
  const e = error as { code?: string; message?: string; details?: string };

  /* 42501 is insufficient_privilege — a grant or a policy refused it. PGRST301
     is the Data API's own "no usable JWT". */
  if (e.code === "42501" || e.code === "PGRST301")
    return "You are not allowed to do that. If you just signed in, try again.";
  if (e.code === "23505")
    return "That already exists. Check whether it is on the map already.";
  if (e.code === "23514")
    return "Some of those values are out of range.";
  if (e.message) return e.details ? `${e.message} — ${e.details}` : e.message;
  return "Something went wrong.";
}
