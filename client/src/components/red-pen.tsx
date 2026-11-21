import { cn } from "@/lib/utils";

/**
 * Metro direction: a result is a station roundel. The ring colour says how it
 * went (line green, amber, red), the number sits inside in bold signage type.
 * File and export names are shared with the notebook direction so pages don't change.
 */

function tone(pct: number) {
  return pct >= 75 ? "text-correct" : pct >= 50 ? "text-due" : "text-pen";
}

export function PenScore({
  score, max, size = "md", animate = true, className, label,
}: {
  score: number; max: number; size?: "sm" | "md" | "lg"; animate?: boolean; className?: string; label?: string;
}) {
  const pct = max ? (score / max) * 100 : 0;
  const dims = { sm: "h-11 w-11 text-[13px]", md: "h-16 w-16 text-lg", lg: "h-24 w-24 text-2xl" }[size];
  const C = 2 * Math.PI * 44;
  return (
    <span role="img" aria-label={label ?? `${score}/${max}`} className={cn("relative inline-flex shrink-0 items-center justify-center", dims, tone(pct), className)}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="10" />
        <circle
          cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
          className={animate ? "pen-ring" : undefined}
          style={{ ["--ring-len" as any]: C }}
        />
      </svg>
      <span className="relative font-bold leading-none tabular-nums text-foreground" aria-hidden="true">
        {score}<span className="text-muted-foreground">/{max}</span>
      </span>
    </span>
  );
}

export function PenMark({ correct, className, label }: { correct: boolean; className?: string; label?: string }) {
  return (
    <span role="img" aria-label={label ?? (correct ? "✓" : "✗")}
      className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white", correct ? "bg-correct" : "bg-pen", className)}>
      <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none" aria-hidden="true">
        {correct
          ? <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />}
      </svg>
    </span>
  );
}

export function PenRemark({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-block text-sm font-semibold text-foreground", className)}>{children}</span>;
}

export function remarkKey(pct: number): string {
  if (pct >= 90) return "pen.excellent";
  if (pct >= 75) return "pen.good";
  if (pct >= 50) return "pen.keepGoing";
  return "pen.letsReview";
}
