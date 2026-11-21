import type { Question } from "./schema";

// Per-student quiz variants and grading.
//
// A quiz can give each student `pickCount` random questions (0 = all) and
// shuffle question order and answer options. The variant is derived from a
// seed (quiz id + student id), so a student sees the same variant every time
// and the server can rebuild it to grade. Answers are stored against the
// ORIGINAL option order, so the results pages need no special handling.

export type VariantSettings = { pickCount: number; shuffle: boolean };
type Answers = Record<string, { answer: string | number }>;

// Small deterministic PRNG (mulberry32).
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const variantSeed = (quizId: number, studentId: number) => (quizId * 2654435761 + studentId * 40503) >>> 0;

const hasOptions = (q: Question) => q.type === "mcq" || q.type === "multi_select";

// The variant question remembers, for each shown option, its original index.
type VariantQuestion = Question & { optionOrder?: number[] };

export function buildVariant(questions: Question[], settings: VariantSettings, seed: number): VariantQuestion[] {
  const rand = rng(seed);
  let list = questions.slice();
  if (settings.pickCount > 0 && settings.pickCount < list.length) {
    // Pick a random subset, then keep the teacher's order unless shuffling.
    const chosen = new Set(shuffled(list.map((q) => q.id), rand).slice(0, settings.pickCount));
    list = list.filter((q) => chosen.has(q.id));
  }
  if (!settings.shuffle) return list;

  return shuffled(list, rand).map((q) => {
    if (!hasOptions(q) || (q.options?.length ?? 0) < 2) return q;
    const order = shuffled(q.options!.map((_, i) => i), rand); // order[newIdx] = oldIdx
    const newIndexOf = (old: number) => order.indexOf(old);
    return {
      ...q,
      options: order.map((old) => q.options![old]),
      correctIndex: q.correctIndex === undefined ? undefined : newIndexOf(q.correctIndex),
      correctIndexes: (q.correctIndexes ?? []).map(newIndexOf),
      optionOrder: order,
    };
  });
}

/** Convert answers given on a variant back to the original option indexes. */
export function answersToOriginal(_original: Question[], variant: VariantQuestion[], answers: Answers): Answers {
  const out: Answers = {};
  for (const q of variant) {
    const a = answers[q.id];
    if (!a) continue;
    const order = q.optionOrder;
    if (!order || a.answer === "" || a.answer === undefined) { out[q.id] = a; continue; }
    if (q.type === "mcq") out[q.id] = { ...a, answer: order[Number(a.answer)] ?? a.answer };
    else if (q.type === "multi_select")
      out[q.id] = {
        ...a,
        answer: String(a.answer).split(",").filter((x) => x !== "").map((x) => order[Number(x)]).sort((x, y) => x - y).join(","),
      };
    else out[q.id] = a;
  }
  return out;
}

/** Score answers against the given questions (the student's variant). */
export function gradeAnswers(questions: Question[], answers: Answers) {
  let score = 0, maxScore = 0, needsGrading = 0;
  const given = (a?: { answer: string | number }) => a && a.answer !== "" && a.answer !== undefined;
  for (const q of questions) {
    maxScore += q.points;
    const a = answers[q.id];
    if (q.type === "mcq" || q.type === "true_false") {
      if (given(a) && Number(a!.answer) === q.correctIndex) score += q.points;
    } else if (q.type === "multi_select") {
      const selected = new Set(given(a) ? String(a!.answer).split(",").filter((x) => x !== "").map(Number) : []);
      const correct = new Set((q.correctIndexes ?? []).map(Number));
      if (selected.size === correct.size && Array.from(selected).every((x) => correct.has(x))) score += q.points;
    } else if (q.type === "fill_blank") {
      const g = a ? String(a.answer ?? "").trim().toLowerCase() : "";
      if (g && g === String(q.correctText ?? "").trim().toLowerCase()) score += q.points;
    } else if (q.type === "numeric") {
      const g = given(a) ? Number(a!.answer) : NaN;
      if (!Number.isNaN(g) && q.correctNumber !== undefined && Math.abs(g - q.correctNumber) <= (q.tolerance ?? 0) + 1e-9)
        score += q.points;
    } else if (a && String(a.answer ?? "").trim()) {
      needsGrading = 1; // open / photo: graded by the teacher
    }
  }
  return { score, maxScore, needsGrading };
}
