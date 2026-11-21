import { useMemo, useRef } from "react";
import { renderMathHtml } from "@/lib/math";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Shows question text with $formulas$ rendered. The HTML is escaped/sanitised in lib/math. */
export function MathText({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderMathHtml(text ?? ""), [text]);
  return <span className={cn("math-text", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

// Snippets for the formula toolbar. `|` marks where the cursor goes.
const SNIPPETS: { label: string; insert: string; title: string }[] = [
  { label: "a/b", insert: "$\\frac{|}{}$", title: "fraction" },
  { label: "x²", insert: "$x^{|}$", title: "power" },
  { label: "√", insert: "$\\sqrt{|}$", title: "sqrt" },
  { label: "ⁿ√", insert: "$\\sqrt[n]{|}$", title: "root" },
  { label: "x₁", insert: "$x_{|}$", title: "index" },
  { label: "π", insert: "$\\pi$|", title: "pi" },
  { label: "≤", insert: "$\\le$|", title: "le" },
  { label: "≥", insert: "$\\ge$|", title: "ge" },
  { label: "≠", insert: "$\\ne$|", title: "ne" },
  { label: "±", insert: "$\\pm$|", title: "pm" },
  { label: "·", insert: "$\\cdot$|", title: "dot" },
  { label: "°", insert: "$^\\circ$|", title: "degree" },
  { label: "∠", insert: "$\\angle $|", title: "angle" },
  { label: "|x|", insert: "$|{|}|$", title: "abs" },
  { label: "log", insert: "$\\log_{|}{}$", title: "log" },
  { label: "sin", insert: "$\\sin |$", title: "sin" },
  { label: "∫", insert: "$\\int_{|}^{} \\, dx$", title: "integral" },
  { label: "∑", insert: "$\\sum_{i=1}^{|}$", title: "sum" },
];

/** A textarea for question text with a formula toolbar and a live preview. */
export function MathEditor({
  value,
  onChange,
  placeholder,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  const { t } = useT();
  const ref = useRef<HTMLTextAreaElement>(null);
  const hasMath = /\$/.test(value);

  const insert = (snippet: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const caret = snippet.indexOf("|");
    const clean = snippet.replace("|", "");
    const next = value.slice(0, start) + clean + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + (caret < 0 ? clean.length : caret);
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1" role="toolbar" aria-label={t("math.toolbar")}>
        {SNIPPETS.map((s) => (
          <button
            key={s.title}
            type="button"
            title={t(`math.${s.title}`)}
            onClick={() => insert(s.insert)}
            className="min-w-8 rounded-md border bg-background px-2 py-1 text-sm font-semibold hover:border-primary hover:text-primary"
          >
            {s.label}
          </button>
        ))}
      </div>
      <Textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={testId} />
      {hasMath ? (
        <div className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-sm">
          <span className="mr-2 text-sm font-medium text-muted-foreground">{t("math.preview")}</span>
          <MathText text={value} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("math.hint")}</p>
      )}
    </div>
  );
}
