import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
export type Resolved = "light" | "dark";

type Ctx = {
  /** What the person chose. */
  theme: Theme;
  /** What that resolves to right now — what to put in `data-theme`. */
  resolved: Resolved;
  setTheme: (theme: Theme) => void;
  /** Light ⇄ dark, resolving "system" to the opposite of what it is showing. */
  toggle: () => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

const QUERY = "(prefers-color-scheme: dark)";

/* localStorage throws outright in some embedded contexts, so every touch is
   guarded and the preference is simply not remembered when it does. */
const read = (key: string): Theme => {
  try {
    const v = localStorage.getItem(key);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
};

const write = (key: string, value: Theme) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

/**
 * Theme state for a prototype.
 *
 * "system" is a real third state, not a default that collapses to one of the
 * other two: someone who has never chosen should follow their OS when it
 * changes at sunset, and someone who has chosen should not.
 */
export function ThemeProvider({
  storageKey = "proto-theme",
  children,
}: {
  storageKey?: string;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(() => read(storageKey));
  const [systemDark, setSystemDark] = useState(
    () => typeof matchMedia === "function" && matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mq = matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: Resolved =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      write(storageKey, next);
    },
    [storageKey],
  );

  const value = useMemo(
    () => ({
      theme,
      resolved,
      setTheme,
      toggle: () => setTheme(resolved === "dark" ? "light" : "dark"),
    }),
    [theme, resolved, setTheme],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
