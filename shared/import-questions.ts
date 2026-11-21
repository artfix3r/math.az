// Turning text from a photo, PDF or Word file into draft questions.
// The result is always reviewed by the teacher before it is added.

export type DraftQuestion = {
  prompt: string;
  options: string[];
  type: "mcq" | "open";
};

// "1." "1)" "12 ." and headings like "Sual 3", "Tapşırıq 3:", "Задание 3.", "Question 3"
const HEADING = /^\s*(?:(?:sual|tapşırıq|tapsiriq|məsələ|məsəle|misal|question|task|exercise|задание|задача|вопрос|упражнение)\s*№?\s*(\d{1,3})\s*[.:)]?|(\d{1,3})\s*[.)])\s*/i;
// "A)" "a." "(B)" "А)" (Cyrillic) at the start of a line
const OPTION_START = /^\s*\(?([A-Ea-eАБВГДабвгд])\s*[).]\s*/;
// several options on one line: "A) 54  B) 56  C) 64"
const INLINE_OPTIONS = /(?:^|\s)\(?([A-Ea-eАБВГДабвгд])\s*\)\s*/g;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function splitInlineOptions(line: string): string[] | null {
  const marks = Array.from(line.matchAll(INLINE_OPTIONS));
  if (marks.length < 2) return null;
  const out: string[] = [];
  marks.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index! : line.length;
    out.push(clean(line.slice(start, end)));
  });
  return out.every(Boolean) ? out : null;
}

function finish(lines: string[]): DraftQuestion | null {
  const promptLines: string[] = [];
  let options: string[] = [];
  for (const raw of lines) {
    const inline = splitInlineOptions(raw);
    if (inline && (options.length || OPTION_START.test(raw))) { options.push(...inline); continue; }
    const m = raw.match(OPTION_START);
    if (m && (options.length || promptLines.length)) { options.push(clean(raw.slice(m[0].length))); continue; }
    if (options.length) options[options.length - 1] = clean(`${options[options.length - 1]} ${raw}`);
    else promptLines.push(raw);
  }
  const prompt = clean(promptLines.join(" "));
  options = options.filter(Boolean);
  if (!prompt && !options.length) return null;
  return { prompt, options, type: options.length >= 2 ? "mcq" : "open" };
}

export function splitQuestions(text: string): DraftQuestion[] {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
  if (!lines.length) return [];

  const blocks: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    const h = line.match(HEADING);
    if (h && !OPTION_START.test(line)) {
      current = [line.slice(h[0].length)];
      blocks.push(current);
    } else if (current) {
      current.push(line);
    } else {
      // Text before the first number (a title or instructions) is skipped
      // when numbered questions follow; kept if nothing is numbered.
      blocks.push((current = [line]));
      (current as any).unnumbered = true;
    }
  }
  const numbered = blocks.filter((b) => !(b as any).unnumbered);
  const use = numbered.length ? numbered : [blocks.flat()];
  return use.map(finish).filter((q): q is DraftQuestion => !!q);
}

const L = "A-Za-z\\u00C0-\\u02AF\\u0400-\\u04FF";
const SUP: Record<string, string> = { "²": "2", "³": "3", "⁴": "4", "⁵": "5", "ⁿ": "n" };

/** Wraps obvious maths (x^2, a², √16, 3/4) in $…$ so it shows as a formula. */
const LOOKALIKE: Record<string, string> = { "а": "a", "в": "b", "с": "c", "е": "e", "о": "o", "р": "p", "х": "x", "у": "y", "к": "k", "м": "m", "т": "t", "н": "h" };
const LOOKALIKE_RE = /[авсеорхукмтн]/g;
// Words that are really Cyrillic (Russian) have letters with no Latin twin.
const REAL_CYRILLIC = /[бгдёжзийлпфцчшщъыьэюяБГДЁЖЗИЙЛПФЦЧШЩЪЫЬЭЮЯ]/;

/** OCR on Azerbaijani pages sometimes reads x as the Cyrillic х; fix lines with no real Russian in them. */
function latinLookalikes(line: string): string {
  return REAL_CYRILLIC.test(line) ? line : line.replace(LOOKALIKE_RE, (c) => LOOKALIKE[c]);
}

export function mathify(text: string): string {
  // Maths italic letters from PDFs (𝑥, 𝑦) become ordinary letters.
  let s = text.replace(/\uD835[\uDC00-\uDFFF]/g, (c) => c.normalize("NFKC"))
    // The Cyrillic schwa (ә) looks identical to the Azerbaijani ə.
    .replace(/ә/g, "ə").replace(/Ә/g, "Ə")
    .split("\n").map(latinLookalikes).join("\n").replace(/\$/g, "\\$");
  s = s.replace(new RegExp(`√\\s*\\(([^()]{1,20})\\)|√\\s*([${L}\\d]+)`, "g"), (_, a, b) => `$\\sqrt{${(a ?? b).trim()}}$`);
  s = s.replace(new RegExp(`([${L}\\d)])\\s*\\^\\s*\\(?(-?[${L}\\d]{1,4})\\)?`, "g"), (_, base, exp) => `$${base}^{${exp}}$`);
  // Only a lone letter or number gets a power; "sm²" and "m³" are units and stay as written.
  s = s.replace(new RegExp(`(?<![${L}])(?<!\\d )([${L}\\d)])([²³⁴⁵ⁿ])`, "g"), (_, base, sup) => `$${base}^{${SUP[sup]}}$`);
  s = s.replace(/(?<![\d/])(\d{1,4})\s*\/\s*(\d{1,4})(?![\d/])/g, (_, a, b) => `$\\frac{${a}}{${b}}$`);
  return s;
}

/**
 * Fixes the symbol mistakes the text reader makes most on school worksheets
 * (it reads letters well but confuses %, °, ² and a "5." at the line start).
 * Applied only to text that came from a photo or scan.
 */
export function repairOcr(text: string): string {
  // Angle questions: the reader turns ° into 9, 7, ”, " or ?. Decided for the
  // whole text, because answer lines like "A) 659 B) 62?" carry no angle words.
  const angles = /buca[qğ]|dərəcə|°|угол|градус|angle|degree/i.test(text);
  const deg = (s: string) => s
    // "1247”" -> "124°" (the sign read as a digit plus a quote)
    .replace(/(?<!\d)(\d{1,3})[79][”“"'’](?!\d)/g, (m, a) => (Number(a) <= 360 ? `${a}°` : m))
    // "26”", "62?", "80º" -> "26°"
    .replace(/(?<!\d)(\d{1,3})\s?[”“"'’?º˚](?!\d)/g, (m, a) => (Number(a) <= 360 ? `${a}°` : m))
    // "6597" -> "65°" (the sign read as two digits)
    .replace(/(?<![\d.,])(\d{1,3})(?:97|99|79|77)(?![\d%])(?![.,]\d)/g, (m, a) => (Number(m) > 360 && Number(a) <= 360 ? `${a}°` : m))
    // "659" where 659 can't be an angle -> "65°"
    .replace(/(?<![\d.,])(\d{1,3})9(?![\d%])(?![.,]\d)/g, (m, a) => (Number(m) > 360 && Number(a) <= 360 ? `${a}°` : m));
  return text
    .split("\n")
    .filter((line) => new RegExp(`[${L}\\d]`).test(line) || line.trim() === "")
    .map((line) => {
      let l = line.replace(/^(\s*)[$S§]\s*[.,]\s+/, "$15. ");
      l = l.replace(/(\d{1,3})96(?=-[A-Za-zƏəIıÖöÜüĞğŞşÇç])/g, "$1%");
      if (angles) l = deg(l);
      l = l.replace(/\b(sm|dm|mm|km|m|см|дм|мм|км|м)\s?[?:"”’](?=\s|,|$)/g, "$1²");
      return l;
    })
    .join("\n");
}
