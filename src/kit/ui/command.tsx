import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./dialog";

/**
 * Command palette. cmdk owns the filtering and the roving selection; this file
 * is the skin, on the same tokens as everything else.
 *
 * It is deliberately built on the kit's own Dialog rather than cmdk's, so the
 * overlay portals inside `[data-proto]` like every other overlay here — see
 * lib/portal-host.tsx.
 */
export const Command = CommandPrimitive;
export const CommandList = CommandPrimitive.List;

/**
 * Substring matching, not cmdk's default subsequence scoring.
 *
 * Out of the box, searching "legal" matches "Update **L**ogo on Mark**e**tin**g**
 * Fl**a**yers" because every letter appears somewhere in order. That is right
 * for a file switcher and wrong for a palette indexing people and workflows,
 * where a near-miss reads as a bug. Every whitespace-separated term has to
 * appear literally; a value that starts with the query sorts above one that
 * merely contains it.
 */
const substring = (value: string, search: string) => {
  const q = search.trim().toLowerCase();
  if (!q) return 1;
  const hay = value.toLowerCase();
  const terms = q.split(/\s+/);
  if (!terms.every((t) => hay.includes(t))) return 0;
  return hay.startsWith(q) ? 1 : 0.5;
};

export function CommandDialog({
  open,
  onOpenChange,
  label = "Command palette",
  description = "Search for a page, a workflow, a template or a person.",
  filter = substring,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: string;
  description?: string;
  filter?: (value: string, search: string) => number;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="top-[14vh] max-w-[36rem] translate-y-0 gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <CommandPrimitive
          loop
          filter={filter}
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[0.75rem] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-4"
        >
          {children}
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}

export function CommandInput({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line px-4">
      <Search className="size-4 shrink-0 text-ink-3" />
      <CommandPrimitive.Input
        className={cn(
          "h-12 w-full bg-transparent text-sm outline-none placeholder:text-ink-4",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function CommandScroll({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn(
        "max-h-[22rem] overflow-y-auto overscroll-contain p-1.5",
        className,
      )}
      {...props}
    />
  );
}

export function CommandEmpty({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className={cn(
        "px-3 py-10 text-center text-[0.8125rem] text-ink-3",
        className,
      )}
      {...props}
    />
  );
}

export const CommandGroup = CommandPrimitive.Group;

export function CommandItem({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-field px-3 py-2 text-sm text-ink-2 outline-none select-none",
        "data-[selected=true]:bg-surface-3 data-[selected=true]:text-ink",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-3",
        className,
      )}
      {...props}
    />
  );
}

/** Trailing hint on a row — what the item is, or the key that runs it. */
export function CommandMeta({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("ml-auto shrink-0 text-[0.75rem] text-ink-4", className)}
      {...props}
    />
  );
}

export function CommandSeparator({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn("-mx-1.5 my-1.5 h-px bg-line", className)}
      {...props}
    />
  );
}

/** The ⌘K badge. Also used inline in the search field that opens the palette. */
export function Kbd({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-[0.3125rem] border border-line-2 bg-surface px-1.5 font-sans text-[0.6875rem] font-medium text-ink-3",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
