import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import { usePortalHost } from "../lib/portal-host";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
  return (
    <DialogPrimitive.Portal container={usePortalHost()}>
      <DialogPrimitive.Overlay className="veil-anim fixed inset-0 z-50 bg-veil" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "pop-anim fixed top-1/2 left-1/2 z-50 grid w-full max-w-[27.5rem] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-panel border border-line bg-surface p-5 shadow-[var(--shadow-pop)]",
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close className="absolute top-3.5 right-3.5 rounded-[0.25rem] text-ink-4 transition-colors outline-none hover:text-ink">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("grid gap-1 pr-6", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2", className)}
      {...props}
    />
  );
}
