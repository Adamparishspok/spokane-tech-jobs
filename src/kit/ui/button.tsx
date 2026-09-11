import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/**
 * Heights and radii are measured, not chosen: every button in the comps is
 * 36px tall on a 6px radius, and the dark primary is a two-stop gradient
 * rather than a flat fill (`.accent-fill`, defined in the app's theme).
 */
const button = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-field font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        accent:
          "accent-fill text-accent-ink shadow-[var(--shadow-accent)] hover:brightness-115",
        brand: "bg-brand text-brand-ink hover:brightness-105",
        outline:
          "border border-line-2 bg-surface text-ink shadow-[var(--shadow-card)] hover:bg-surface-2",
        subtle: "bg-surface-3 text-ink hover:bg-line",
        ghost: "text-ink-3 hover:bg-surface-3 hover:text-ink",
        danger:
          "border border-line-2 bg-surface text-danger shadow-[var(--shadow-card)] hover:bg-danger-soft hover:border-danger/30",
        "danger-ghost": "text-danger hover:bg-danger-soft",
      },
      size: {
        sm: "h-7 px-2.5 text-[0.8125rem] [&_svg]:size-3.5",
        md: "h-9 px-3.5 text-sm [&_svg]:size-4",
        lg: "h-10 px-5 text-sm [&_svg]:size-4",
        /* Obsidian's scale: a 48px control on an 8px radius. Added when the
           second app landed rather than overridden per call site — a size is
           the kit's job, and every app that wants a taller button wants the
           same icon and label sizes with it. */
        xl: "h-12 px-5 text-[0.9375rem] [&_svg]:size-[1.125rem]",
        "icon-xl": "size-12 [&_svg]:size-[1.125rem]",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-7 [&_svg]:size-3.5",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "outline", size: "md", block: false },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof button> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(button({ variant, size, block }), className)}
      {...props}
    />
  );
}

export { button as buttonVariants };
