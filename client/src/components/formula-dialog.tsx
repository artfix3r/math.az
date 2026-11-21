import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import katex from "katex";
import { renderMathHtml } from "@/lib/math";
import { GROUPS, type Key } from "@/lib/formula-keys";

/**
 * A visual formula editor, so teachers never have to type LaTeX.
 * Uses MathLive (loaded only when the dialog first opens). Typing works like a
 * calculator: "1/2" becomes a fraction, "x^2" a power, "sqrt" a root.
 * The buttons insert a template with empty boxes to fill in.
 */

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
  const [group, setGroup] = useState(GROUPS[0].id);

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
      <DialogContent className="max-w-xl gap-3 p-4 sm:p-6 [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>{t("formula.title")}</DialogTitle>
          <DialogDescription>{t("formula.hint")}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <div ref={host} className="min-h-16 overflow-x-auto rounded-md border border-input bg-card px-2 py-2 text-2xl focus-within:ring-2 focus-within:ring-ring" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label={t("math.toolbar")}>
            {GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={group === g.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setGroup(g.id)}
                className={"min-h-9 shrink-0 rounded-md px-3 text-sm font-medium transition-colors " + (group === g.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                data-testid={`formula-tab-${g.id}`}
              >
                {t(`formula.group.${g.id}`)}
              </button>
            ))}
          </div>
          <div className="flex max-h-48 flex-wrap content-start gap-1.5 overflow-y-auto" role="toolbar" aria-label={t(`formula.group.${group}`)}>
            {GROUPS.find((g) => g.id === group)!.keys.map((k) => (
              <button
                key={k.label}
                type="button"
                disabled={!ready}
                title={k.title ? t(`math.${k.title}`) : k.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => press(k)}
                className="min-h-10 min-w-10 rounded-md border bg-card px-2.5 text-[15px] font-medium transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {k.preview
                  ? <span aria-label={k.title ? t(`math.${k.title}`) : k.label} dangerouslySetInnerHTML={{ __html: katex.renderToString(k.preview, { throwOnError: false }) }} />
                  : k.label}
              </button>
            ))}
          </div>
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
