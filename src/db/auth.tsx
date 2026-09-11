import { useMemo } from "react";
import { hasBackend, neon } from "./client";

/**
 * Who is signed in.
 *
 * Neon's Managed Better Auth issues the JWT; the Data API verifies it and
 * exposes its `sub` to Postgres as `auth.user_id()`. Every policy in
 * `db/schema.sql` is written against that one value, which is why this file is
 * short — the session is the whole of the client's security model, and the
 * rules live in the database.
 *
 * Signed out is a first-class state, not a wall. The SDK holds an anonymous
 * token for readers with no account, so the directory and the map are fully
 * usable before anybody signs up; an account is asked for at the point
 * something is written. A local directory that gates the looking has nothing
 * anybody wants.
 */

export const hasAuth = hasBackend;

export type Viewer = {
  id: string;
  name: string;
  email: string;
  /** Monogram hue, derived from the id so it is stable across devices. */
  hue: number;
};

/**
 * The Better Auth client, or null when this build has no backend.
 *
 * A clone without `.env.local` still runs and still draws the map, so every
 * consumer has to survive its absence rather than throw on import.
 */
const auth = neon?.auth ?? null;

/**
 * The signed-in person, or null.
 *
 * `useSession` is a hook, so it cannot be called conditionally — and it does
 * not exist at all when there is no client. `useSessionSafe` below keeps the
 * call unconditional in both cases by always calling *a* hook: the real one
 * when there is a client, a constant when there is not.
 */
export function useViewer(): Viewer | null {
  const session = useSessionSafe();

  return useMemo(() => {
    const user = session?.user;
    if (!user) return null;
    /* An anonymous token has a subject too. It is not a person, and treating
       one as signed in would put an "account" in the rail for every visitor
       and let the forms open against a session that can write nothing. */
    if (user.isAnonymous) return null;

    const id = String(user.id);
    let hue = 0;
    for (let i = 0; i < id.length; i++) hue = (hue * 31 + id.charCodeAt(i)) % 360;

    return {
      id,
      name: user.name || user.email?.split("@")[0] || "You",
      email: user.email ?? "",
      hue,
    };
  }, [session]);
}

type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  isAnonymous?: boolean;
};

/* The adapter exposes Better Auth's React client, whose `useSession` returns
   `{ data, isPending }`. Typed structurally here rather than imported: the
   SDK is a beta and this is the only shape the app depends on, so a rename
   downstream shows up as one failing cast instead of a broken build. */
function useSessionSafe(): { user?: SessionUser } | null {
  const client = auth as
    | { useSession?: () => { data?: { user?: SessionUser } | null } }
    | null;

  if (!client?.useSession) {
    /* No hook to call, and no hook is called — the branch is decided once at
       module load and never changes between renders, so hook order is stable.
       eslint cannot see that, hence the disable. */
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return null;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data } = client.useSession();
  return data ?? null;
}

type Credentials = { email: string; password: string; name?: string };

export async function signInWithEmail({ email, password }: Credentials) {
  const client = auth as {
    signIn: { email: (input: Credentials) => Promise<{ error?: unknown }> };
  } | null;
  if (!client) throw new Error("No authentication configured");
  const { error } = await client.signIn.email({ email, password });
  if (error) throw error;
}

export async function signUpWithEmail({ email, password, name }: Credentials) {
  const client = auth as {
    signUp: {
      email: (input: Required<Credentials>) => Promise<{ error?: unknown }>;
    };
  } | null;
  if (!client) throw new Error("No authentication configured");
  const { error } = await client.signUp.email({
    email,
    password,
    name: name ?? email.split("@")[0],
  });
  if (error) throw error;
}

export async function signOut() {
  const client = auth as { signOut?: () => Promise<unknown> } | null;
  await client?.signOut?.();
}
