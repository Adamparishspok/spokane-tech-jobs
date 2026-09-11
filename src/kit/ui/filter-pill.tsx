import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "./menu";

/**
 * The control every list in the comps filters and sorts with: a 34px pill with
 * a trailing chevron. It is not a native <select> — the menu has to be styled,
 * and the trigger has to be able to show a set filter differently from an
 * unset one, which native chrome will not do.
 */
export function FilterPill({
  value,
  options,
  onChange,
  /** The value that counts as "no filter applied". */
  neutral,
  className,
  icon,
}: {
  value: string;
  options: readonly string[];
  onChange?: (value: string) => void;
  neutral?: string;
  className?: string;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const set = neutral !== undefined && value !== neutral;

  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        className={cn(
          "inline-flex h-[2.125rem] items-center gap-1.5 rounded-field border bg-surface px-2.5 text-[0.8125rem] font-medium whitespace-nowrap shadow-[var(--shadow-card)] transition-colors outline-none",
          set
            ? "border-ink-3 text-ink"
            : "border-line-2 text-ink-2 hover:border-line-3 hover:text-ink",
          className,
        )}
      >
        {icon}
        {value}
        <ChevronDown
          className={cn(
            "size-3.5 text-ink-4 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </MenuTrigger>
      <MenuContent align="start">
        <MenuRadioGroup value={value} onValueChange={(v) => onChange?.(v)}>
          {options.map((o) => (
            <MenuRadioItem key={o} value={o}>
              {o}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
