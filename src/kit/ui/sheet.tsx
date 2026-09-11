import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import { usePortalHost } from "../lib/portal-host";

/**
 * A panel that slides in from an edge. Dialog semantics — focus trap, escape,
 * outside click — with a translate transition instead of a scale one.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

export function SheetContent({
  className,
  children,
  side = "right",
  showClose = true,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  side?: "right" | "left";
  showClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal container={usePortalHost()}>
      <DialogPrimitive.Overlay className="veil-anim fixed inset-0 z-50 bg-veil" />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "sheet-anim fixed inset-y-0 z-50 flex w-[30rem] max-w-[92vw] flex-col bg-surface shadow-[var(--shadow-pop)] outline-none",
          side === "right"
            ? "right-0 border-l border-line"
            : "left-0 border-r border-line",
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close className="absolute top-4 right-4 rounded-[0.25rem] text-ink-4 transition-colors outline-none hover:text-ink">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
