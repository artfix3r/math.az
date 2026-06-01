import { cn } from "./utils";

// Playful accent color map for groups/avatars
export const COLOR_MAP: Record<string, { bg: string; text: string; ring: string; solid: string }> = {
  violet: { bg: "bg-violet-100 dark:bg-violet-500/15", text: "text-violet-700 dark:text-violet-300", ring: "ring-violet-300 dark:ring-violet-500/40", solid: "bg-violet-500" },
  pink: { bg: "bg-pink-100 dark:bg-pink-500/15", text: "text-pink-700 dark:text-pink-300", ring: "ring-pink-300 dark:ring-pink-500/40", solid: "bg-pink-500" },
  amber: { bg: "bg-amber-100 dark:bg-amber-500/15", text: "text-amber-700 dark:text-amber-300", ring: "ring-amber-300 dark:ring-amber-500/40", solid: "bg-amber-500" },
  teal: { bg: "bg-teal-100 dark:bg-teal-500/15", text: "text-teal-700 dark:text-teal-300", ring: "ring-teal-300 dark:ring-teal-500/40", solid: "bg-teal-500" },
  blue: { bg: "bg-blue-100 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-300", ring: "ring-blue-300 dark:ring-blue-500/40", solid: "bg-blue-500" },
  green: { bg: "bg-green-100 dark:bg-green-500/15", text: "text-green-700 dark:text-green-300", ring: "ring-green-300 dark:ring-green-500/40", solid: "bg-green-500" },
};

export function colorOf(c?: string) {
  return COLOR_MAP[c ?? "violet"] ?? COLOR_MAP.violet;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-extrabold tracking-tight", className)}>
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="28" height="28" rx="9" fill="url(#mg)" />
        <path d="M9 11h14M9 16h14M9 21h8" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="22" cy="21" r="2.4" fill="#fde68a" />
        <defs>
          <linearGradient id="mg" x1="2" y1="2" x2="30" y2="30">
            <stop stopColor="#a855f7" />
            <stop offset="1" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <span>
        math<span className="text-primary">.az</span>
      </span>
    </span>
  );
}

// Soft floating math symbols background for hero / auth pages
export function MathBackdrop() {
  const items = [
    { s: "+", x: "8%", y: "18%", c: "text-violet-400/30", r: "-12deg", z: "text-6xl" },
    { s: "π", x: "82%", y: "22%", c: "text-pink-400/30", r: "10deg", z: "text-7xl" },
    { s: "÷", x: "20%", y: "72%", c: "text-amber-400/30", r: "8deg", z: "text-5xl" },
    { s: "√", x: "70%", y: "68%", c: "text-teal-400/30", r: "-8deg", z: "text-6xl" },
    { s: "∑", x: "45%", y: "12%", c: "text-blue-400/25", r: "4deg", z: "text-5xl" },
    { s: "×", x: "90%", y: "50%", c: "text-green-400/30", r: "-6deg", z: "text-5xl" },
    { s: "∞", x: "12%", y: "44%", c: "text-pink-400/25", r: "12deg", z: "text-5xl" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {items.map((it, i) => (
        <span
          key={i}
          className={cn("absolute font-black select-none", it.c, it.z)}
          style={{ left: it.x, top: it.y, transform: `rotate(${it.r})` }}
        >
          {it.s}
        </span>
      ))}
    </div>
  );
}

export const QUESTION_TYPE_LABEL: Record<string, string> = {
  mcq: "Multiple choice",
  open: "Open question",
  photo: "Photo-based",
};
