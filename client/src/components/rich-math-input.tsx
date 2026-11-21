import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";
import { toParts, joinParts, type Part } from "@/lib/rich-math";
import { formulaHtml } from "./formula-dialog";

/**
 * A text box where formulas show as rendered maths, not LaTeX.
 * Formulas are small blocks you click to edit; everything else is ordinary text.
 * The value is stored as "text $latex$ text", like before.
 */

export type RichMathHandle = {
  /** Put a formula where the cursor was (or at the end). */
  insertFormula: (latex: string) => void;
  focus: () => void;
};

const CHIP = "math-chip";

function chipNode(latex: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = CHIP;
  span.contentEditable = "false";
  span.dataset.latex = latex;
  span.tabIndex = 0;
  span.setAttribute("role", "button");
  span.innerHTML = formulaHtml(latex);
  return span;
}

function render(el: HTMLElement, value: string) {
  el.replaceChildren();
  for (const p of toParts(value)) {
    if (p.kind === "math") el.appendChild(chipNode(p.value));
    else {
      p.value.split("\n").forEach((line, i) => {
        if (i > 0) el.appendChild(document.createElement("br"));
        if (line) el.appendChild(document.createTextNode(line));
      });
    }
  }
}

function serialize(el: HTMLElement): string {
  const parts: Part[] = [];
  const text = (v: string) => {
    const last = parts[parts.length - 1];
    if (last?.kind === "text") last.value += v;
    else parts.push({ kind: "text", value: v });
  };
  const walk = (node: Node, first: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) { text((node.textContent ?? "").replace(/ /g, " ")); return; }
    if (!(node instanceof HTMLElement)) return;
    if (node.classList.contains(CHIP)) { parts.push({ kind: "math", value: node.dataset.latex ?? "" }); return; }
    if (node.tagName === "BR") { text("\n"); return; }
    // Browsers wrap new lines in <div> on Enter.
    if ((node.tagName === "DIV" || node.tagName === "P") && !first) text("\n");
    node.childNodes.forEach((c, i) => walk(c, i === 0));
  };
  el.childNodes.forEach((c, i) => walk(c, i === 0));
  const out = joinParts(parts);
  return out.replace(/\n$/, "");
}

export const RichMathInput = forwardRef<RichMathHandle, {
  value: string;
  onChange: (v: string) => void;
  onEditFormula: (latex: string, replace: (latex: string | null) => void) => void;
  placeholder?: string;
  singleLine?: boolean;
  className?: string;
  testId?: string;
  ariaLabel?: string;
}>(function RichMathInput({ value, onChange, onEditFormula, placeholder, singleLine, className, testId, ariaLabel }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);
  const saved = useRef<Range | null>(null);

  // Only rebuild the DOM when the value changed from outside (keeps the cursor).
  useEffect(() => {
    if (!el.current || value === last.current) return;
    render(el.current, value);
    el.current.dataset.empty = String(value === "");
    last.current = value;
  }, [value]);

  const emit = useCallback(() => {
    if (!el.current) return;
    const v = serialize(el.current);
    el.current.dataset.empty = String(v.trim() === "");
    last.current = v;
    onChange(v);
  }, [onChange]);

  const remember = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && el.current?.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange();
  };

  useImperativeHandle(ref, () => ({
    focus: () => el.current?.focus(),
    insertFormula: (latex: string) => {
      const root = el.current;
      if (!root) return;
      const chip = chipNode(latex);
      const space = document.createTextNode(" ");
      const range = saved.current && root.contains(saved.current.startContainer) ? saved.current : null;
      if (range) {
        range.deleteContents();
        range.insertNode(space);
        range.insertNode(chip);
      } else {
        root.append(chip, space);
      }
      const sel = window.getSelection();
      const after = document.createRange();
      after.setStartAfter(space);
      after.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(after);
      saved.current = after.cloneRange();
      emit();
    },
  }), [emit]);

  const openChip = (chip: HTMLElement) => {
    onEditFormula(chip.dataset.latex ?? "", (latex) => {
      if (latex === null) chip.remove();
      else {
        chip.dataset.latex = latex;
        chip.innerHTML = formulaHtml(latex);
      }
      emit();
    });
  };

  return (
    <div
      ref={el}
      role="textbox"
      aria-multiline={!singleLine}
      aria-label={ariaLabel ?? placeholder}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      data-testid={testId}
      className={cn(
        "rich-math w-full rounded-md border border-input bg-card px-3 py-2.5 text-base leading-[1.9] outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "data-[empty=true]:before:pointer-events-none data-[empty=true]:before:text-muted-foreground data-[empty=true]:before:content-[attr(data-placeholder)]",
        singleLine ? "min-h-11" : "min-h-24",
        className,
      )}
      onInput={emit}
      onKeyUp={remember}
      onMouseUp={remember}
      onBlur={remember}
      onKeyDown={(e) => {
        if (singleLine && e.key === "Enter") e.preventDefault();
        const target = e.target as HTMLElement;
        if ((e.key === "Enter" || e.key === " ") && target.classList?.contains(CHIP)) { e.preventDefault(); openChip(target); }
      }}
      onClick={(e) => {
        const chip = (e.target as HTMLElement).closest(`.${CHIP}`) as HTMLElement | null;
        if (chip && el.current?.contains(chip)) openChip(chip);
      }}
      onPaste={(e) => {
        // Paste as plain text; "$...$" in pasted text still becomes a formula.
        e.preventDefault();
        const txt = e.clipboardData.getData("text/plain");
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const frag = document.createDocumentFragment();
        const tmp = document.createElement("div");
        render(tmp, singleLine ? txt.replace(/\s*\n\s*/g, " ") : txt);
        const nodes = Array.from(tmp.childNodes);
        nodes.forEach((n) => frag.appendChild(n));
        const lastNode = nodes[nodes.length - 1];
        range.insertNode(frag);
        if (lastNode) { range.setStartAfter(lastNode); range.collapse(true); sel.removeAllRanges(); sel.addRange(range); }
        emit();
      }}
    />
  );
});
