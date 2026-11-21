import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { renderMathHtml } from "@/lib/math";

/**
 * A visual formula editor, so teachers never have to type LaTeX.
 * Uses MathLive (loaded only when the dialog first opens). Typing works like a
 * calculator: "1/2" becomes a fraction, "x^2" a power, "sqrt" a root.
 * The buttons insert a template with empty boxes to fill in.
 */

type Key = { label: string; latex: string; title?: string };

// `#?` is an empty box the teacher fills in; `#@` wraps the current selection.
const KEYS: Key[][] = [
  [
    { label: "a⁄b", latex: "\\frac{#@}{#?}", title: "fraction" },
    { label: "x²", latex: "#@^{#?}", title: "power" },
    { label: "√", latex: "\\sqrt{#@}", title: "sqrt" },
    { label: "ⁿ√", latex: "\\sqrt[#?]{#@}", title: "root" },
    { label: "x₁", latex: "#@_{#?}", title: "index" },
    { label: "|x|", latex: "\\left|#@\\right|", title: "abs" },
    { label: "( )", latex: "\\left(#@\\right)", title: "brackets" },
  ],
  [
    { label: "π", latex: "\\pi" },
    { label: "±", latex: "\\pm" },
    { label: "×", latex: "\\times" },
    { label: "÷", latex: "\\div" },
    { label: "·", latex: "\\cdot" },
    { label: "≤", latex: "\\le" },
    { label: "≥", latex: "\\ge" },
    { label: "≠", latex: "\\ne" },
    { label: "≈", latex: "\\approx" },
    { label: "°", latex: "^{\\circ}" },
    { label: "∠", latex: "\\angle " },
    { label: "∞", latex: "\\infty" },
  ],
  [
    { label: "sin", latex: "\\sin\\left(#?\\right)" },
    { label: "cos", latex: "\\cos\\left(#?\\right)" },
    { label: "tg", latex: "\\tan\\left(#?\\right)" },
    { label: "log", latex: "\\log_{#?}\\left(#?\\right)" },
    { label: "lg", latex: "\\lg\\left(#?\\right)" },
    { label: "∑", latex: "\\sum_{#?}^{#?}" },
    { label: "∫", latex: "\\int_{#?}^{#?}#?\\,dx" },
    { label: "→", latex: "\\to" },
    { label: "α", latex: "\\alpha" },
    { label: "β", latex: "\\beta" },
    { label: "Δ", latex: "\\Delta" },
  ],
];

let mathlivePromise: Promise<typeof import("mathlive")> | null = null;
function loadMathlive() {
  if (!mathlivePromise) {
    mathlivePromise = import("mathlive").then((m) => {
      // KaTeX fonts are already on the page; no extra font or sound downloads.
      m.MathfieldElement.fontsDirectory = null;
      m.MathfieldElement.soundsDirectory = null;
      return m;
    });
  }
  return mathlivePromise;
}

export function FormulaDialog({
  open,
  onOpenChange,
  initial,
  template,
  onSave,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** LaTeX of the formula being edited, or "" for a new one. */
  initial: string;
  /** For a new formula: a template to start from (e.g. the fraction). */
  template?: string;
  onSave: (latex: string) => void;
  onRemove?: () => void;
}) {
  const { t } = useT();
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [latex, setLatex] = useState(initial);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLatex(initial);
    loadMathlive().then(({ MathfieldElement }) => {
      if (cancelled || !host.current) return;
      const mf = new MathfieldElement();
      mf.mathVirtualKeyboardPolicy = "manual";
      mf.smartFence = true;
      mf.setAttribute("aria-label", t("formula.title"));
      mf.className = "formula-field";
      mf.value = initial;
      mf.addEventListener("input", () => setLatex(mf.value));
      host.current.replaceChildren(mf);
      field.current = mf;
      setReady(true);
      requestAnimationFrame(() => {
        mf.focus();
        if (template && !initial) {
          mf.executeCommand(["insert", template, { selectionMode: "placeholder" }]);
          setLatex(mf.value);
        }
      });
    });
    return () => {
      cancelled = true;
      field.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const press = (k: Key) => {
    const mf = field.current;
    if (!mf) return;
    mf.executeCommand(["insert", k.latex, { selectionMode: "placeholder" }]);
    mf.focus();
    setLatex(mf.value);
  };

  const clean = latex.replace(/\\placeholder\{\}/g, "").trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-3 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{t("formula.title")}</DialogTitle>
          <DialogDescription>{t("formula.hint")}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <div ref={host} className="min-h-16 rounded-md border border-input bg-card px-2 py-2 text-2xl focus-within:ring-2 focus-within:ring-ring" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>

        <div className="space-y-1.5" role="toolbar" aria-label={t("math.toolbar")}>
          {KEYS.map((row, i) => (
            <div key={i} className="flex flex-wrap gap-1.5">
              {row.map((k) => (
                <button
                  key={k.label}
                  type="button"
                  disabled={!ready}
                  title={k.title ? t(`math.${k.title}`) : k.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => press(k)}
                  className="min-h-10 min-w-10 rounded-md border bg-card px-2.5 text-[15px] font-medium transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {k.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          {onRemove ? (
            <Button type="button" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => { onRemove(); onOpenChange(false); }}>
              <Trash2 className="h-4 w-4" /> {t("formula.remove")}
            </Button>
          ) : <span />}
          <Button
            type="button"
            disabled={!clean}
            data-testid="button-formula-save"
            onClick={() => { onSave(clean); onOpenChange(false); }}
          >
            {initial ? t("formula.update") : t("formula.insert")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Rendered formula HTML for a chip in the editor. */
export function formulaHtml(latex: string): string {
  return renderMathHtml(`$${latex}$`);
}
