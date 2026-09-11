import { cn } from "@kit/lib/cn";
import { initials } from "../domain";

/**
 * The mark.
 *
 * A ponderosa in outline — the one asset carried over from the original comps
 * intact, because it was the only part of them that said Spokane. There it sat
 * in white inside a purple rounded square at 40px, where the needles collapsed
 * into a blur. Here it is drawn in the brand green directly on the panel, with
 * no tile around it, so the silhouette does the work at any size.
 */
export function Pine({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 18 31"
      fill="currentColor"
      className={cn("size-5", className)}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.98652 0.00989857C9.98652 0.00989857 9.98652 0.011432 8.49511 0.011432C8.05458 0.011432 7.74418 0.0115032 7.52546 0.011625H7.35608C7.00371 0.0113302 7.00371 0.0103868 7.00371 0.0103868L7.00371 0.00896485L7.00372 0.00645325L7.00375 0.00274611L7.00377 0.000494656L7.00332 0.015734C7.00264 0.0344084 7.00101 0.0693751 6.99721 0.118324C6.98956 0.216707 6.97338 0.368508 6.93955 0.555887C6.87084 0.936423 6.73539 1.42989 6.47638 1.91492C6.00408 2.79939 5.05628 3.81134 2.81055 3.90082L2.9293 6.88129C4.58322 6.81539 5.87436 6.37993 6.87115 5.7474C6.78385 6.08205 6.64278 6.47162 6.41704 6.85813C5.88654 7.76642 4.7728 8.87586 2.11328 8.97274L2.22187 11.9536C3.96072 11.8903 5.33603 11.4847 6.41376 10.8839C6.37629 10.9652 6.33651 11.0466 6.29427 11.128C5.63646 12.3951 4.33293 13.7711 1.4043 13.8911L1.52644 16.8714C3.6961 16.7825 5.33706 16.1584 6.56442 15.2767C6.46644 15.5511 6.3472 15.834 6.20226 16.116C5.45305 17.5736 3.97213 19.1344 0.699219 19.2699L0.822591 22.2502C3.46304 22.1409 5.37665 21.2972 6.74445 20.149C6.61382 20.5981 6.42634 21.0917 6.15822 21.5835C5.33757 23.089 3.68178 24.7535 0 24.8972L0.116334 27.8778C3.29634 27.7537 5.50165 26.696 7.00391 25.3026V30.419H9.98674V25.2734C11.4896 26.6809 13.7033 27.7523 16.9052 27.8773L17.0215 24.8967C13.3397 24.753 11.6839 23.0885 10.8633 21.583C10.6017 21.1032 10.4169 20.6218 10.2867 20.1815C11.6518 21.3131 13.5541 22.1419 16.1696 22.2502L16.293 19.2699C13.0201 19.1344 11.5391 17.5736 10.7899 16.116C10.6447 15.8333 10.5252 15.5498 10.4271 15.2748C11.6547 16.1575 13.2965 16.7825 15.4677 16.8714L15.5898 13.8911C12.6612 13.7711 11.3577 12.3951 10.6999 11.128C10.6578 11.0469 10.6181 10.9657 10.5808 10.8848C11.6581 11.4848 13.0327 11.8898 14.7703 11.9531L14.8789 8.97228C12.2194 8.8754 11.1056 7.76596 10.5751 6.85767C10.3497 6.47172 10.2087 6.08272 10.1214 5.74839C11.1179 6.38012 12.4083 6.81495 14.0609 6.8808L14.1797 3.90033C11.934 3.81085 10.9862 2.7989 10.5139 1.91443C10.2548 1.4294 10.1194 0.935935 10.0507 0.555398C10.0169 0.36802 10.0007 0.216219 9.99303 0.117836C9.98923 0.0688868 9.98759 0.0339201 9.98691 0.0152457L9.98647 0L9.98649 0.00225782L9.98651 0.00596497L9.98652 0.00847657L9.98652 0.00989857Z"
      />
    </svg>
  );
}

/**
 * Mark and name together. The serif is the wordmark's, and only the wordmark's.
 *
 * The name is set on two lines because it is three words and the places it
 * appears are narrow — a dialog and the specimen header, both around 24rem.
 * On one line it either wraps somewhere arbitrary or forces the card wider
 * than the form inside it wants to be.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5 text-ink", className)}>
      <Pine className="size-7 shrink-0 text-brand" />
      <span className="font-display text-[1.25rem] leading-[1.05] tracking-tight">
        Spokane
        <br />
        Tech Jobs
      </span>
    </span>
  );
}

/**
 * The stand-in for a company logo.
 *
 * The comps left a blank grey rounded square on every row — a placeholder for
 * a logo that, for most of a local directory, will never be uploaded. Rather
 * than ship an empty box or reproduce somebody's trademark badly, each company
 * gets a monogram tile whose hue comes off the company record. The mark and
 * the name therefore cannot drift apart, and an unclaimed listing looks
 * finished rather than broken.
 */
export function Monogram({
  name,
  hue,
  className,
  round,
}: {
  name: string;
  hue: number;
  className?: string;
  round?: boolean;
}) {
  return (
    <span
      className={cn(
        "monogram grid shrink-0 place-items-center font-semibold select-none",
        round ? "rounded-full" : "rounded-card",
        "size-10 text-[0.8125rem]",
        className,
      )}
      style={{ ["--mono-h" as string]: hue }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
