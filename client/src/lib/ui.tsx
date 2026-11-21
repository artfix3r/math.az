import { cn } from "./utils";

// Group / avatar identity colours: the covers of a stack of exercise books.
// Keys are stored in the database, so they stay as they are.
export const COLOR_MAP: Record<string, { bg: string; text: string; ring: string; solid: string }> = {
  violet: { bg: "bg-[#ECE8F4] dark:bg-[#2A2440]", text: "text-[#4B3A78] dark:text-[#C9BDF0]", ring: "ring-[#CFC5E6] dark:ring-[#4A3F6E]", solid: "bg-[#5B4A8F]" },
  pink:   { bg: "bg-[#F6E7EB] dark:bg-[#3A2229]", text: "text-[#8A2E4A] dark:text-[#F0B7C7]", ring: "ring-[#E7C3CE] dark:ring-[#643848]", solid: "bg-[#9C3A57]" },
  amber:  { bg: "bg-[#F5EDDC] dark:bg-[#352B18]", text: "text-[#74500F] dark:text-[#EBCB8B]", ring: "ring-[#E3D1A8] dark:ring-[#5E4A22]", solid: "bg-[#A0741F]" },
  teal:   { bg: "bg-[#E1EFEC] dark:bg-[#18302C]", text: "text-[#1E5C55] dark:text-[#9FD8CE]", ring: "ring-[#BBDBD4] dark:ring-[#2E554E]", solid: "bg-[#2A7A70]" },
  blue:   { bg: "bg-[#E5EBF8] dark:bg-[#1C2742]", text: "text-[#2340A0] dark:text-[#AFC0F5]", ring: "ring-[#C3CFEE] dark:ring-[#33467A]", solid: "bg-[#2340A0]" },
  green:  { bg: "bg-[#E2F0E7] dark:bg-[#17301F]", text: "text-[#1E6B43] dark:text-[#A3DCB8]", ring: "ring-[#BDDDC9] dark:ring-[#2C5A3B]", solid: "bg-[#1E8A53]" },
};

export function colorOf(c?: string) {
  return COLOR_MAP[c ?? "blue"] ?? COLOR_MAP.blue;
}

/** A green line with three stations, then the wordmark. */
export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-bold tracking-tight", className)}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" className="shrink-0">
        <rect width="28" height="28" rx="8" fill={inverted ? "#F5B700" : "#0A7B55"} />
        <path d="M5 14h18" stroke={inverted ? "#16191D" : "#fff"} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="7" cy="14" r="2.3" fill={inverted ? "#F5B700" : "#0A7B55"} stroke={inverted ? "#16191D" : "#fff"} strokeWidth="1.6" />
        <circle cx="14" cy="14" r="2.3" fill={inverted ? "#F5B700" : "#0A7B55"} stroke={inverted ? "#16191D" : "#fff"} strokeWidth="1.6" />
        <circle cx="21" cy="14" r="3" fill={inverted ? "#16191D" : "#fff"} />
      </svg>
      <span className={cn(inverted ? "text-white" : "text-foreground")}>
        math<span className={inverted ? "text-white/55" : "text-muted-foreground"}>.az</span>
      </span>
    </span>
  );
}

export const QUESTION_TYPE_LABEL: Record<string, string> = {
  mcq: "Multiple choice",
  open: "Open question",
  photo: "Photo-based",
};
