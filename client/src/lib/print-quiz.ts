import type { Question } from "@shared/schema";

// What a printed quiz looks like: numbered questions, lettered options,
// answer space for written answers, and a separate answer key.

export type PrintItem = {
  number: number;
  prompt: string;
  imageUrl: string;
  points: number;
  options: { letter: string; text: string }[];
  /** Lines of blank space to leave for a written answer (0 = none). */
  answerLines: number;
};

export type PrintModel = { items: PrintItem[]; answerKey: { number: number; answer: string }[]; totalPoints: number };

const letter = (i: number) => String.fromCharCode(65 + i);

const ANSWER_LINES: Partial<Record<Question["type"], number>> = {
  open: 6,
  photo: 6,
  fill_blank: 1,
  numeric: 1,
};

export function buildPrintModel(questions: Question[], tf: { true: string; false: string }): PrintModel {
  const items: PrintItem[] = [];
  const answerKey: PrintModel["answerKey"] = [];

  questions.forEach((q, i) => {
    const number = i + 1;
    const opts =
      q.type === "true_false"
        ? [tf.true, tf.false]
        : q.type === "mcq" || q.type === "multi_select"
          ? q.options ?? []
          : [];
    items.push({
      number,
      prompt: q.prompt,
      imageUrl: q.imageUrl ?? "",
      points: q.points ?? 1,
      options: opts.map((text, oi) => ({ letter: letter(oi), text })),
      answerLines: ANSWER_LINES[q.type] ?? 0,
    });

    let answer = "—";
    if ((q.type === "mcq" || q.type === "true_false") && q.correctIndex !== undefined) answer = letter(q.correctIndex);
    else if (q.type === "multi_select") answer = [...(q.correctIndexes ?? [])].sort((a, b) => a - b).map(letter).join(", ") || "—";
    else if (q.type === "fill_blank") answer = q.correctText || "—";
    else if (q.type === "numeric" && q.correctNumber !== undefined)
      answer = q.tolerance ? `${q.correctNumber} ± ${q.tolerance}` : String(q.correctNumber);
    answerKey.push({ number, answer });
  });

  return { items, answerKey, totalPoints: items.reduce((s, it) => s + it.points, 0) };
}
