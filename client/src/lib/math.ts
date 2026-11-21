import katex from "katex";

// Math in question text: teachers write LaTeX between dollar signs.
//   $x^2$        -> inline formula
//   $$\frac12$$  -> formula on its own line
//   \$5          -> a literal dollar sign
// Everything else is plain text and is HTML-escaped before display.

export type MathSegment = { kind: "text" | "inline" | "display"; value: string };

const ESCAPED_DOLLAR = "\u0000";

export function splitMath(input: string): MathSegment[] {
  const text = input.replace(/\\\$/g, ESCAPED_DOLLAR);
  const out: MathSegment[] = [];
  const pushText = (v: string) => {
    if (!v) return;
    const value = v.replace(/\u0000/g, "$");
    const last = out[out.length - 1];
    if (last?.kind === "text") last.value += value;
    else out.push({ kind: "text", value });
  };

  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("$", i);
    if (start < 0) break;
    const display = text.startsWith("$$", start);
    const delim = display ? "$$" : "$";
    const end = text.indexOf(delim, start + delim.length);
    if (end < 0) break; // unclosed: the rest is plain text
    const body = text.slice(start + delim.length, end);
    if (!body.trim()) break;
    pushText(text.slice(i, start));
    out.push({ kind: display ? "display" : "inline", value: body.replace(/\u0000/g, "\\$") });
    i = end + delim.length;
  }
  pushText(text.slice(i));
  return out.length ? out : [{ kind: "text", value: "" }];
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Safe HTML for a piece of question text with its formulas rendered. */
export function renderMathHtml(input: string): string {
  return splitMath(input)
    .map((seg) => {
      if (seg.kind === "text") return escapeHtml(seg.value).replace(/\n/g, "<br>");
      try {
        // \displaystyle keeps fractions and limits full size inside sentences,
        // which is easier to read for school maths.
        const src = seg.kind === "inline" ? `\\displaystyle ${seg.value}` : seg.value;
        return katex.renderToString(src, {
          displayMode: seg.kind === "display",
          throwOnError: true,
          trust: false,
          strict: "ignore",
          output: "htmlAndMathml",
        });
      } catch {
        // Show the teacher's source so they can see what to fix.
        const src = seg.kind === "display" ? `$$${seg.value}$$` : `$${seg.value}$`;
        return `<code class="math-error">${escapeHtml(src)}</code>`;
      }
    })
    .join("");
}
