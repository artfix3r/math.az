import { useEffect } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * On-screen number pad, so phones don't open (and close) the system keyboard
 * over the game. Physical keys work too: digits, minus, Backspace, Enter.
 */
export function Keypad({
  value, onChange, onEnter, allowMinus = false, disabled = false, enterLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  allowMinus?: boolean;
  disabled?: boolean;
  enterLabel?: string;
}) {
  const press = (k: string) => {
    if (disabled) return;
    if (k === "back") return onChange(value.slice(0, -1));
    if (k === "-") return onChange(value.startsWith("-") ? value.slice(1) : "-" + value);
    if (k === "enter") return onEnter?.();
    if (value.replace("-", "").length >= 5) return;
    onChange(value + k);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
      else if ((e.key === "-" || e.key === "−") && allowMinus) press("-");
      else if (e.key === "Enter" && onEnter) press("enter");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", allowMinus ? "-" : onEnter ? "enter" : "", "0", "back"];
  const extra = allowMinus && onEnter;
  return (
    <div className="mx-auto w-full max-w-xs select-none">
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k, i) =>
          k === "" ? <span key={i} /> : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => press(k)}
              data-testid={`key-${k}`}
              aria-label={k === "back" ? "Delete" : k === "-" ? "Minus" : k === "enter" ? enterLabel : k}
              className={cn(
                "flex h-14 items-center justify-center rounded-md border bg-card text-xl font-semibold tabular-nums shadow-sm transition-[transform,background-color] active:scale-[0.96] active:bg-secondary disabled:opacity-50",
                k === "enter" && "bg-primary text-primary-foreground text-base active:bg-primary/90",
              )}
            >
              {k === "back" ? <Delete className="h-5 w-5" /> : k === "-" ? "−" : k === "enter" ? enterLabel : k}
            </button>
          ),
        )}
      </div>
      {extra && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => press("enter")}
          data-testid="key-enter"
          className="mt-2 flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {enterLabel}
        </button>
      )}
    </div>
  );
}
