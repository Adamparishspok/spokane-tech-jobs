import { cn } from "../lib/cn";

/**
 * Step progress on a workflow row. Fixed track width in the comps — the bar is
 * read across rows, so it cannot size to its container or the comparison
 * between two rows stops meaning anything.
 */
export function StepProgress({
  value,
  total,
  className,
}: {
  value: number;
  total: number;
  className?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
  return (
    <span
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Step ${value} of ${total}`}
      className={cn(
        "block h-1 w-[4.4375rem] overflow-hidden rounded-full bg-line",
        className,
      )}
    >
      <span
        className="block h-full rounded-full bg-ok transition-[width] duration-500 ease-[var(--ease-out-quint)]"
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
