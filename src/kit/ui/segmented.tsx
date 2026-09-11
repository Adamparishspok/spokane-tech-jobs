import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "../lib/cn";

export type SegmentedItem<T extends string> = {
  value: T;
  label?: string;
  icon?: React.ReactNode;
};

/**
 * The inset segmented control — Group/Person, High/Medium/Low, list/grid. The
 * selected face is a white card on a recessed track; it slides between
 * positions with a shared layout animation rather than cross-fading, so the
 * control reads as one moving object.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  items,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  items: readonly SegmentedItem<T>[];
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}) {
  const layoutId = useId();
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      aria-label={ariaLabel}
      onValueChange={(v) => v && onChange(v as T)}
      className={cn(
        "inline-flex items-center rounded-field border border-line bg-surface-3 p-0.5",
        className,
      )}
    >
      {items.map((item) => {
        const on = item.value === value;
        return (
          <ToggleGroupPrimitive.Item
            key={item.value}
            value={item.value}
            aria-label={item.label ?? item.value}
            className={cn(
              "relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-[0.3125rem] font-medium whitespace-nowrap transition-colors outline-none",
              size === "sm"
                ? "h-6 px-2 text-[0.75rem] [&_svg]:size-3.5"
                : "h-7 px-4 text-[0.8125rem] [&_svg]:size-4",
              on ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {on && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 560, damping: 42 }}
                className="absolute inset-0 rounded-[0.3125rem] border border-line-2 bg-surface shadow-[var(--shadow-card)]"
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {item.icon}
              {item.label}
            </span>
          </ToggleGroupPrimitive.Item>
        );
      })}
    </ToggleGroupPrimitive.Root>
  );
}
