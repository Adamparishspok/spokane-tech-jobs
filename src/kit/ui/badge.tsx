import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

const badge = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap font-medium",
  {
    variants: {
      variant: {
        /* The count that trails a tab name. Pill, hairline, tabular. */
        count:
          "num min-w-[1.625rem] rounded-full border border-line bg-surface px-1.5 py-0.5 text-[0.75rem] text-ink-3",
        /* A tag on a record — "Sales", "Contracts". */
        label: "rounded-md px-1.5 py-0.5 text-[0.75rem]",
        /* Neutral state chip — "You", "Default". */
        chip: "rounded-md border border-line bg-surface px-1.5 py-0.5 text-[0.75rem] text-ink-3",
        ok: "rounded-md bg-ok-soft px-1.5 py-0.5 text-[0.75rem] text-ok-2",
      },
    },
    defaultVariants: { variant: "chip" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badge>) {
  return (
    <span
      data-slot="badge"
      className={cn(badge({ variant }), className)}
      {...props}
    />
  );
}
