import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useViewer } from "./auth";
import { explain, hasBackend } from "./client";
import { listMyClaims, listSavedJobIds, saveJob, unsaveJob } from "./mutations";

/**
 * The two things the directory knows about *you*: the jobs you saved and the
 * listings you have asked to claim.
 *
 * Both are read back from the database rather than kept only in the component
 * that wrote them — a saved job that disappears on reload is worse than one
 * that was never offered. Both are RLS-scoped to the signed-in user, so
 * signing out empties them rather than showing the last person's, and a build
 * with no backend simply has none.
 */
export type Mine = {
  /** False while the first read is in flight. */
  ready: boolean;
  /** Null when everything is fine, a sentence when the last write failed. */
  error: string | null;
  isSaved: (jobId: string) => boolean;
  /** Optimistic: the bookmark fills immediately and rolls back on refusal. */
  toggleSave: (jobId: string) => void;
  /** The job whose save is in flight, so one button can disable itself. */
  savingJobId: string | null;
  hasClaimRequest: (companyId: string) => boolean;
  /** Called by the claim form on success, so the button stops offering. */
  noteClaimRequest: (companyId: string) => void;
};

const MineCtx = createContext<Mine | null>(null);

/* One shared empty set, so a signed-out render does not hand back a fresh
   value every time and invalidate every memo downstream of it. */
const EMPTY: ReadonlySet<string> = new Set<string>();

export function MineProvider({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  const viewerId = viewer?.id ?? null;

  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(EMPTY);
  const [claimIds, setClaimIds] = useState<ReadonlySet<string>>(EMPTY);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingJobId, setSavingJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasBackend || !viewerId) {
      setSavedIds(EMPTY);
      setClaimIds(EMPTY);
      setError(null);
      setReady(true);
      return;
    }

    let live = true;
    setReady(false);
    void (async () => {
      try {
        const [jobs, claims] = await Promise.all([
          listSavedJobIds(viewerId),
          listMyClaims(viewerId),
        ]);
        if (!live) return;
        setSavedIds(new Set(jobs));
        setClaimIds(new Set(claims));
        setError(null);
      } catch (e) {
        if (live) setError(explain(e));
      } finally {
        if (live) setReady(true);
      }
    })();

    return () => {
      live = false;
    };
  }, [viewerId]);

  const toggleSave = useCallback(
    (jobId: string) => {
      /* Signed out there is nobody to save it for. The button never calls this
         in that state — it opens the auth dialog instead — but the guard is
         here as well, because the alternative is a write that RLS refuses and
         an error sentence the person cannot act on. */
      if (!viewerId) return;

      const wasSaved = savedIds.has(jobId);
      const flip = (on: boolean) =>
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (on) next.add(jobId);
          else next.delete(jobId);
          return next;
        });

      /* The bookmark answers immediately; a save that waits on a round trip
         reads as a button that did not work. The rollback is the price. */
      flip(!wasSaved);
      setSavingJobId(jobId);
      setError(null);

      void (async () => {
        try {
          if (wasSaved) await unsaveJob(jobId, viewerId);
          else await saveJob(jobId, viewerId);
        } catch (e) {
          setError(explain(e));
          flip(wasSaved);
        } finally {
          setSavingJobId((current) => (current === jobId ? null : current));
        }
      })();
    },
    [savedIds, viewerId],
  );

  const noteClaimRequest = useCallback((companyId: string) => {
    setClaimIds((prev) => new Set(prev).add(companyId));
  }, []);

  const value = useMemo<Mine>(
    () => ({
      ready,
      error,
      isSaved: (jobId: string) => savedIds.has(jobId),
      toggleSave,
      savingJobId,
      hasClaimRequest: (companyId: string) => claimIds.has(companyId),
      noteClaimRequest,
    }),
    [
      claimIds,
      error,
      noteClaimRequest,
      ready,
      savedIds,
      savingJobId,
      toggleSave,
    ],
  );

  return <MineCtx.Provider value={value}>{children}</MineCtx.Provider>;
}

export function useMine(): Mine {
  const ctx = useContext(MineCtx);
  if (!ctx) throw new Error("useMine must be used inside <MineProvider>");
  return ctx;
}
