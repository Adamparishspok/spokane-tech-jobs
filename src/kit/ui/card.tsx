import type { ComponentProps, ElementType } from "react";
import { cn } from "../lib/cn";

/**
 * The comps' card is a hairline, not a cloud: a light rule all round with a
 * fractionally heavier bottom edge. `--shadow-card` carries that edge, so a
 * card never needs a border override to sit correctly on the page ground.
 */
export function Card<T extends ElementType = "div">({
  as,
  className,
  ...props
}: { as?: T } & ComponentProps<"div">) {
  const Comp = (as ?? "div") as ElementType;
  return (
    <Comp
      data-slot="card"
      className={cn(
        "rounded-card border border-line bg-surface shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

/** A row in a list of records — a card whose hover state says it opens. */
export function RowCard<T extends ElementType = "li">({
  as,
  className,
  ...props
}: { as?: T } & ComponentProps<"li">) {
  const Comp = (as ?? "li") as ElementType;
  return (
    <Comp
      data-slot="row-card"
      className={cn(
        "group rounded-card border border-line bg-surface shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-150 hover:border-line-3 hover:shadow-[var(--shadow-pop)]",
        className,
      )}
      {...props}
    />
  );
}
