import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "motion/react";
import { createContext, useContext, useId, type ComponentProps } from "react";
import { cn } from "../lib/cn";

/**
 * The comps' tab bar: a full-width hairline with a short dark rule under the
 * active label.
 *
 * The rule is one element that moves between triggers rather than one per
 * trigger fading in and out — a tab bar is a single control, and the indicator
 * is the part of it that says which. Radix does not expose the active value to
 * a trigger, so `Tabs` puts the controlled value in context; an uncontrolled
 * `Tabs` falls back to a static rule per trigger.
 */
const TabsCtx = createContext<{ value?: string; layoutId: string } | null>(
  null,
);

export function Tabs({
  value,
  ...props
}: ComponentProps<typeof TabsPrimitive.Root>) {
  const layoutId = useId();
  return (
    <TabsCtx.Provider value={{ value, layoutId }}>
      <TabsPrimitive.Root value={value} {...props} />
    </TabsCtx.Provider>
  );
}

export function TabsList({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex items-center gap-6 border-b border-line", className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  value,
  children,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  const ctx = useContext(TabsCtx);
  const controlled = ctx?.value !== undefined;
  const active = ctx?.value === value;

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      value={value}
      className={cn(
        "relative -mb-px inline-flex items-center gap-2 pb-2.5 text-[0.8125rem] font-medium text-ink-3 transition-colors hover:text-ink data-[state=active]:text-ink",
        !controlled &&
          "border-b-2 border-transparent data-[state=active]:border-ink-2",
        className,
      )}
      {...props}
    >
      {children}
      {controlled && active && (
        <motion.span
          layoutId={ctx.layoutId}
          transition={{ type: "spring", stiffness: 520, damping: 44 }}
          className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ink-2"
        />
      )}
    </TabsPrimitive.Trigger>
  );
}

export const TabsContent = TabsPrimitive.Content;
