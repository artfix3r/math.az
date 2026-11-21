// A student's marked work: each question with their answer, the mark, and the
// teacher's comment. Built on the server so answer keys only leave it when allowed.
import type { Question } from "./schema";

type Answer = string | number;
type SubLike = {
  answers: string; gradedPoints: string; comments: string; questionIds: string;
  needsGrading: number; attemptNumber: number;
};

export type ReviewStatus = "correct" | "wrong" | "partial" | "pending";
export type ReviewItem = {
  id: string;
  type: Question["type"];
  prompt: string;
  imageUrl: string;
  options: string[];
  points: number;
  answer: Answer;
  awarded: number;
  status: ReviewStatus;
  comment: string;
  correct?: { index?: number; indexes?: number[]; text?: string; number?: number; tolerance?: number };
};

const parse = <T>(s: string, fallback: T): T => {
  try { return (s ? JSON.parse(s) : fallback) ?? fallback; } catch { return fallback; }
};

/** Automatic check; null for open and photo answers, which a teacher marks. */
export function autoCorrect(q: Question, a: Answer | undefined): boolean | null {
  if (q.type === "open" || q.type === "photo") return null;
  if (a === undefined || a === "") return false;
  if (q.type === "mcq" || q.type === "true_false") return Number(a) === q.correctIndex;
  if (q.type === "multi_select") {
    const selected = String(a).split(",").filter((x) => x !== "").map(Number);
    const correct = new Set((q.correctIndexes ?? []).map(Number));
    return selected.length === correct.size && selected.every((x) => correct.has(x));
  }
  if (q.type === "fill_blank") return String(a).trim().toLowerCase() === String(q.correctText ?? "").trim().toLowerCase();
  if (q.type === "numeric") return q.correctNumber !== undefined && Math.abs(Number(a) - q.correctNumber) <= (q.tolerance ?? 0) + 1e-9;
  return null;
}

/** Correct answers are shown once marked and the student can no longer try again. */
export function canRevealAnswers(
  quiz: { dueAt: number | null; maxAttempts: number },
  sub: { needsGrading: number; attemptNumber: number },
  now: number,
): boolean {
  if (sub.needsGrading) return false;
  const deadlinePassed = !!quiz.dueAt && now > quiz.dueAt;
  const noAttemptsLeft = quiz.maxAttempts > 0 && sub.attemptNumber >= quiz.maxAttempts;
  return deadlinePassed || noAttemptsLeft;
}

export function buildReview(questions: Question[], sub: SubLike, reveal: boolean): ReviewItem[] {
  const answers = parse<Record<string, { answer: Answer }>>(sub.answers, {});
  const graded = parse<Record<string, number>>(sub.gradedPoints, {});
  const comments = parse<Record<string, string>>(sub.comments, {});
  const shown = parse<string[] | null>(sub.questionIds, null);
  const list = shown ? questions.filter((q) => shown.includes(q.id)) : questions;

  return list.map((q) => {
    const answer = answers[q.id]?.answer ?? "";
    let awarded: number;
    let status: ReviewStatus;
    if (q.id in graded) {
      awarded = Math.max(0, Math.min(q.points, Number(graded[q.id]) || 0));
      status = awarded >= q.points ? "correct" : awarded > 0 ? "partial" : "wrong";
    } else {
      const ok = autoCorrect(q, answer);
      if (ok === null) {
        awarded = 0;
        status = String(answer).trim() ? "pending" : "wrong";
      } else {
        awarded = ok ? q.points : 0;
        status = ok ? "correct" : "wrong";
      }
    }
    const item: ReviewItem = {
      id: q.id, type: q.type, prompt: q.prompt, imageUrl: q.imageUrl ?? "", options: q.options ?? [],
      points: q.points, answer, awarded, status, comment: String(comments[q.id] ?? ""),
    };
    if (reveal) {
      if (q.type === "mcq" || q.type === "true_false") item.correct = { index: q.correctIndex };
      else if (q.type === "multi_select") item.correct = { indexes: q.correctIndexes ?? [] };
      else if (q.type === "fill_blank") item.correct = { text: q.correctText ?? "" };
      else if (q.type === "numeric") item.correct = { number: q.correctNumber, tolerance: q.tolerance ?? 0 };
    }
    return item;
  });
}
