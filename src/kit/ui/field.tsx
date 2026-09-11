import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/* Fields sit one notch shorter than buttons in the comps — 34px against 36 —
   and carry a hairline rather than the button's shadow. */
const FIELD =
  "w-full rounded-field border border-line-2 bg-surface px-3 text-sm text-ink transition-[border-color,box-shadow] outline-none placeholder:text-ink-4 focus-visible:border-ink-4 focus-visible:ring-[3px] focus-visible:ring-ink/8 disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(FIELD, "h-[2.125rem]", className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        FIELD,
        "min-h-20 resize-none py-2 leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "text-[0.8125rem] leading-none font-medium text-ink select-none",
        className,
      )}
      {...props}
    />
  );
}

/** Label over control, the vertical rhythm the comps' forms use throughout. */
export function FieldRow({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-[0.8125rem] text-ink-3">{hint}</p>}
    </div>
  );
}

export { FIELD as fieldClass };
