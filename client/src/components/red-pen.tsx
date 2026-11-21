import { cn } from "@/lib/utils";

/**
 * The teacher's red pen. Used only for judgement: a circled score, a tick or
 * cross next to an answer, and a short handwritten remark. Nothing else in the
 * interface is drawn in this colour or this hand.
 *
 * Every mark can be drawn on (`animate`) after `delay` ms, so a sheet can be
 * marked in reading order. With reduced motion the marks are simply there.
 */

const LOOP = "M8 30 C 6 14, 30 4, 58 6 C 86 8, 98 20, 96 32 C 94 46, 70 54, 46 53 C 22 52, 6 44, 10 28 C 12 20, 20 14, 30 11";
const v = (o: Record<string, string | number>) => o as React.CSSProperties;

export function PenScore({
  score, max, size = "md", animate = true, delay = 120, className, label,
}: {
  score: number; max: number; size?: "sm" | "md" | "lg"; animate?: boolean; delay?: number; className?: string;
  /** Accessible text, e.g. "Score 8 of 10". */
  label?: string;
}) {
  const dims = { sm: "h-9 w-[4.25rem] text-xl", md: "h-14 w-[6.5rem] text-[2rem]", lg: "h-20 w-36 text-5xl" }[size];
  return (
    <span role="img" aria-label={label ?? `${score}/${max}`} className={cn("relative inline-flex shrink-0 items-center justify-center text-pen", dims, className)}>
      <svg viewBox="0 0 104 60" className="absolute inset-0 h-full w-full overflow-visible" fill="none" aria-hidden="true">
        <path
          d={LOOP} stroke="currentColor" strokeWidth={size === "sm" ? 3.2 : 2.6} strokeLinecap="round"
          className={animate ? "pen-stroke" : undefined}
          style={v({ "--pen-len": 290, "--pen-delay": `${delay + 240}ms` })}
        />
      </svg>
      {/* The digits are written first, then circled: ink settles, then the loop closes around it. */}
      <span
        className={cn("font-hand relative leading-none tabular-nums", animate && "pen-write")}
        style={v({ "--pen-delay": `${delay}ms`, "--pen-dur": "320ms" })}
        aria-hidden="true"
      >
        {score}<span className="opacity-80">/</span>{max}
      </span>
    </span>
  );
}

export function PenMark({
  correct, className, label, animate = false, delay = 0,
}: { correct: boolean; className?: string; label?: string; animate?: boolean; delay?: number }) {
  const s = (d: number, len = 1) => animate
    ? { className: "pen-stroke", style: v({ "--pen-len": len, "--pen-delay": `${d}ms`, "--pen-dur": "200ms" }) }
    : {};
  return (
    <svg viewBox="0 0 24 24" className={cn("h-6 w-6 shrink-0", correct ? "text-correct" : "text-pen", className)} fill="none" role="img" aria-label={label ?? (correct ? "✓" : "✗")}>
      {correct ? (
        <path pathLength={1} {...s(delay)} d="M3.5 13.5c2 1.4 3.6 3.2 5 5.5C11 12.5 15.5 7 21 3.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <path pathLength={1} {...s(delay)} d="M5 5c4.5 4.2 9 9.2 14 14.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <path pathLength={1} {...s(delay + 170)} d="M19 4.5C13.8 9.5 9 14.5 4.5 19.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function PenRemark({
  children, className, animate = false, delay = 0,
}: { children: React.ReactNode; className?: string; animate?: boolean; delay?: number }) {
  return (
    <span
      className={cn("font-hand inline-block -rotate-1 text-xl leading-tight text-pen", animate && "pen-write", className)}
      style={animate ? v({ "--pen-delay": `${delay}ms`, "--pen-dur": "520ms" }) : undefined}
    >
      {children}
    </span>
  );
}

/** A short handwritten verdict for a percentage, in the student's language. */
export function remarkKey(pct: number): string {
  if (pct >= 90) return "pen.excellent";
  if (pct >= 75) return "pen.good";
  if (pct >= 50) return "pen.keepGoing";
  return "pen.letsReview";
}
