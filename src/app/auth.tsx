import { Button, Dialog, DialogContent, FieldRow, Input } from "@kit/ui";
import { Check, RefreshCw, TriangleAlert } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { hasAuth, signInWithEmail, signUpWithEmail } from "../db/auth";
import { explain } from "../db/client";
import { useDirectory } from "../db/directory";
import { Wordmark } from "../design/brand";
import { Basemap } from "../map/basemap";
import { HOME } from "../map/spokane";

/**
 * Signing in, and the one screen that means the product is broken.
 *
 * The prototype drew this flow with nothing behind it — a password field that
 * validated nothing and a confirmation screen that confirmed nothing. The form
 * below looks similar and is not: Neon's Managed Better Auth issues the
 * session, the password rules are the ones the server actually enforces, and a
 * failed sign-in says why.
 *
 * Two things survived from the prototype, because they were decisions rather
 * than scaffolding:
 *
 * - **The map stays behind it.** The product is a map of Spokane, and saying
 *   so before anybody has an account is worth more than a blank ground.
 * - **It is a dialog, not a wall.** The directory is public. You are asked to
 *   sign in at the point you want to add something or save something, and
 *   cancelling puts you back where you were rather than on a landing page. A
 *   local directory that gates the looking has nothing anybody wants.
 */

export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [screen, setScreen] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { companies, jobs, refresh } = useDirectory();

  /* The rules Better Auth enforces, shown as they are met rather than ticked
     green over an empty field — which is what the prototype's comps drew. */
  const rules = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "A number", ok: /\d/.test(password) },
    { label: "A letter", ok: /[a-zA-Z]/.test(password) },
  ];
  const ready =
    email.includes("@") &&
    (screen === "signin" ? password.length > 0 : rules.every((r) => r.ok));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (screen === "signin") await signInWithEmail({ email, password });
      else await signUpWithEmail({ email, password });
      setPassword("");
      /* The session changed, so what the directory is allowed to return
         changed with it — a signed-in reader can see their own pending
         submissions. */
      refresh();
      onOpenChange(false);
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  };

  if (!hasAuth) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[24rem] p-6">
          <Wordmark />
          <p className="mt-4 text-sm leading-relaxed text-ink-2">
            This build has no backend configured, so there is nothing to sign in
            to. The map still works.
          </p>
          <p className="mt-2 text-[0.8125rem] text-ink-3">
            Set <code className="font-mono">VITE_NEON_DATABASE_URL</code> in{" "}
            <code className="font-mono">.env.local</code>.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[24rem] p-6">
        <Wordmark />
        <h2 className="mt-4 font-display text-[1.75rem] leading-tight text-ink">
          {screen === "signin" ? "Welcome back" : "Get on the map"}
        </h2>
        <p className="mt-1 text-[0.8125rem] text-ink-3">
          <span className="num">{companies.length}</span> companies and{" "}
          <span className="num">{jobs.length}</span> open roles across the
          Inland Northwest.
        </p>

        <form className="mt-5 grid gap-3" onSubmit={submit}>
          <FieldRow label="Email" htmlFor="auth-email">
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </FieldRow>

          <FieldRow label="Password" htmlFor="auth-password">
            <Input
              id="auth-password"
              type="password"
              autoComplete={
                screen === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FieldRow>

          {screen === "signup" && (
            <ul className="grid gap-1">
              {rules.map((rule) => (
                <li
                  key={rule.label}
                  className={
                    rule.ok
                      ? "flex items-center gap-1.5 text-[0.75rem] text-ok-2"
                      : "flex items-center gap-1.5 text-[0.75rem] text-ink-4"
                  }
                >
                  <Check
                    className={rule.ok ? "size-3.5" : "size-3.5 opacity-30"}
                    aria-hidden
                  />
                  {rule.label}
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-card border border-danger/25 bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="accent"
            size="lg"
            block
            disabled={!ready || busy}
            className="mt-1"
          >
            {busy
              ? "One moment…"
              : screen === "signin"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-center text-[0.8125rem] text-ink-3">
          {screen === "signin" ? (
            <>
              No account yet?{" "}
              <button
                type="button"
                onClick={() => {
                  setScreen("signup");
                  setError(null);
                }}
                className="font-medium text-brand-2 underline-offset-2 hover:underline"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have one?{" "}
              <button
                type="button"
                onClick={() => {
                  setScreen("signin");
                  setError(null);
                }}
                className="font-medium text-brand-2 underline-offset-2 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The database did not answer.
 *
 * This is a different screen from an empty directory and has to say so. The
 * prototype could not have this state at all — a fixture is always reachable —
 * and it is the single most important thing the move to a real backend added
 * to the interface. Without it an outage renders as "no companies match these
 * filters", which is a lie the reader has no way to see through.
 */
export function Unreachable({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const camera = useMemo(
    () => ({ center: { lng: -117.36, lat: 47.665 }, zoom: HOME.zoom + 0.4 }),
    [],
  );

  return (
    <div className="relative grid h-dvh place-items-center overflow-hidden bg-ground p-6">
      <Stage camera={camera} />
      <div className="glass relative w-full max-w-[24rem] rounded-panel border p-6">
        <Wordmark />
        <div className="mt-5 grid size-10 place-items-center rounded-full bg-warn-soft text-warn">
          <TriangleAlert className="size-5" />
        </div>
        <h1 className="mt-4 font-display text-[1.75rem] leading-tight text-ink">
          Can't reach the directory
        </h1>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-3">
          The map is drawn from coordinates and still works. The companies,
          roles and people come from a database, and it did not answer.
        </p>
        <p className="mt-3 rounded-card border border-line-2 bg-surface-2 px-3 py-2 font-mono text-[0.75rem] break-words text-ink-3">
          {message}
        </p>
        <Button
          variant="accent"
          size="lg"
          block
          className="mt-5"
          onClick={onRetry}
        >
          <RefreshCw />
          Try again
        </Button>
      </div>
    </div>
  );
}

/** The map behind the card: real, and quiet enough to read over. */
function Stage({
  camera,
}: {
  camera: { center: { lng: number; lat: number }; zoom: number };
}) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={host} className="absolute inset-0 bg-map" aria-hidden>
      {size.width > 0 && <Basemap camera={camera} size={size} />}
      {/* A veil rather than an opacity: the map keeps its own contrast and the
          card gets a ground that is the same in both themes. */}
      <div className="absolute inset-0 bg-ground/55" />
    </div>
  );
}
