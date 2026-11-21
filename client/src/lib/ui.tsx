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

/** π with a red-pen tick at its corner, then the wordmark. */
export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  const tile = inverted ? "#fff" : "#2340A0";
  const ink = inverted ? "#2340A0" : "#fff";
  const pen = inverted ? "#D92D2D" : "#FF5A5A";
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <svg width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="shrink-0">
        <rect width="48" height="48" rx="11" fill={tile} />
        <path d="M11 15h26M19 15v19M30 15v14c0 4 2 5 6 4" stroke={ink} strokeWidth="5" strokeLinecap="round" />
        <path d="M33 9l3 3 5-6" stroke={pen} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={cn(inverted ? "text-white" : "text-foreground")}>
        math<span className={inverted ? "text-white/60" : "text-muted-foreground"}>.az</span>
      </span>
    </span>
  );
}

export const QUESTION_TYPE_LABEL: Record<string, string> = {
  mcq: "Multiple choice",
  open: "Open question",
  photo: "Photo-based",
};
