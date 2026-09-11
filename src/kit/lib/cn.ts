import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows the utilities Tailwind ships. The kit's radii are
 * named after their role rather than their size — `rounded-card`,
 * `rounded-field`, `rounded-panel`, plus whatever an app adds — so out of the
 * box `cn("rounded-full", "rounded-field")` keeps both and the winner is
 * whichever Tailwind happens to emit last. That is how a 40px avatar meant to
 * be a rounded square comes out a circle.
 *
 * Registering them in the same conflict group as `rounded-*` restores the
 * rule the whole kit relies on: a caller's className always wins.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ["chip", "field", "card", "panel"] }],
    },
  },
});

/** Merge conditional classes, with later Tailwind utilities beating earlier
 *  ones — so a caller's `className` can always override a component default. */
export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
