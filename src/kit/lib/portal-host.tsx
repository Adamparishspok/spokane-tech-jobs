import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Radix portals default to document.body — outside `[data-proto]`, which is
 * where the scoped reset and the theme both live. A menu opened from a block
 * embedded in the landing site would inherit that site's typography instead.
 *
 * So every overlay portals into a host rendered *inside* the app root. Wrap the
 * root in <PortalHost> and pass `usePortalHost()` to each Radix Portal.
 */
const Ctx = createContext<HTMLElement | null>(null);

export function PortalHost({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return (
    <Ctx.Provider value={el}>
      {children}
      <div ref={setEl} data-slot="portal-host" />
    </Ctx.Provider>
  );
}

/** `undefined` until the host mounts, which is what Radix wants for "default". */
export function usePortalHost(): HTMLElement | undefined {
  return useContext(Ctx) ?? undefined;
}
