import { useMemo, useRef, useState } from "react";
import { Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormulaDialog } from "./formula-dialog";
import { RichMathInput, type RichMathHandle } from "./rich-math-input";
import { renderMathHtml } from "@/lib/math";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Shows question text with $formulas$ rendered. The HTML is escaped/sanitised in lib/math. */
export function MathText({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderMathHtml(text ?? ""), [text]);
  return <span className={cn("math-text", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

// Quick buttons above the question box. Each opens the formula editor with
// that shape ready to fill in, so nobody has to know LaTeX.
const QUICK: { label: string; template: string; title: string }[] = [
  { label: "a⁄b", template: "\\frac{#?}{#?}", title: "fraction" },
  { label: "x²", template: "#?^{#?}", title: "power" },
  { label: "√", template: "\\sqrt{#?}", title: "sqrt" },
  { label: "x₁", template: "#?_{#?}", title: "index" },
  { label: "π", template: "\\pi", title: "pi" },
  { label: "≤", template: "\\le", title: "le" },
  { label: "°", template: "#?^{\\circ}", title: "degree" },
];

type EditState = { initial: string; template?: string; save: (latex: string | null) => void } | null;

function useFormulaEditing() {
  const [edit, setEdit] = useState<EditState>(null);
  const dialog = (
    <FormulaDialog
      open={!!edit}
      onOpenChange={(v) => { if (!v) setEdit(null); }}
      initial={edit?.initial ?? ""}
      template={edit?.template}
      onSave={(latex) => edit?.save(latex)}
      onRemove={edit?.initial ? () => edit.save(null) : undefined}
    />
  );
  return { setEdit, dialog };
}

/**
 * The question text box. Formulas appear as real maths; click one to change it.
 * "Formula" opens a visual editor (fractions, roots, powers by buttons or typing
 * 1/2, x^2, sqrt). People who know LaTeX can switch to the code view.
 */
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
  const rich = useRef<RichMathHandle>(null);
  const [code, setCode] = useState(false);
  const { setEdit, dialog } = useFormulaEditing();

  const newFormula = (template?: string) =>
    setEdit({ initial: "", template, save: (latex) => { if (latex) rich.current?.insertFormula(latex); } });

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={t("math.toolbar")}>
        <Button type="button" size="sm" variant="secondary" className="gap-1.5" disabled={code} onMouseDown={(e) => e.preventDefault()} onClick={() => newFormula()} data-testid={testId ? `${testId}-formula` : undefined}>
          <Sigma className="h-4 w-4" /> {t("math.addFormula")}
        </Button>
        {QUICK.map((q) => (
          <button
            key={q.title}
            type="button"
            disabled={code}
            title={t(`math.${q.title}`)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => newFormula(q.template)}
            className="min-h-9 min-w-9 rounded-md border bg-card px-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
          >
            {q.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCode((c) => !c)}
          className="ml-auto min-h-9 rounded-md px-2 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          data-testid={testId ? `${testId}-code` : undefined}
        >
          {code ? t("math.hideCode") : t("math.showCode")}
        </button>
      </div>
      {code ? (
        <>
          <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={testId} className="font-mono text-sm" />
          {/\$/.test(value) && (
            <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm">
              <span className="mr-2 font-medium text-muted-foreground">{t("math.preview")}</span>
              <MathText text={value} />
            </div>
          )}
        </>
      ) : (
        <RichMathInput
          ref={rich}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          testId={testId}
          onEditFormula={(latex, replace) => setEdit({ initial: latex, save: replace })}
        />
      )}
      {dialog}
    </div>
  );
}

/** A one-line answer option that can hold formulas too. */
export function MathOptionInput({
  value, onChange, placeholder, testId, className,
}: { value: string; onChange: (v: string) => void; placeholder?: string; testId?: string; className?: string }) {
  const { t } = useT();
  const rich = useRef<RichMathHandle>(null);
  const { setEdit, dialog } = useFormulaEditing();
  return (
    <div className={cn("flex min-w-0 flex-1 items-stretch gap-1.5", className)}>
      <RichMathInput
        ref={rich}
        singleLine
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        testId={testId}
        className="min-w-0 flex-1 py-1.5"
        onEditFormula={(latex, replace) => setEdit({ initial: latex, save: replace })}
      />
      <Button
        type="button" variant="outline" size="icon" className="shrink-0"
        title={t("math.addFormula")} aria-label={t("math.addFormula")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setEdit({ initial: "", save: (latex) => { if (latex) rich.current?.insertFormula(latex); } })}
      >
        <Sigma className="h-4 w-4" />
      </Button>
      {dialog}
    </div>
  );
}
