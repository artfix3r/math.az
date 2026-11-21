// Homework deadlines and reminder selection (used by server and client).

/** Remind students this long before a quiz is due. */
export const REMINDER_WINDOW_MS = 24 * 3600_000;

export type DeadlineState = "none" | "open" | "soon" | "closed";

export function deadlineState(dueAt: number | null | undefined, now: number): DeadlineState {
  if (!dueAt) return "none";
  if (now > dueAt) return "closed";
  return dueAt - now <= REMINDER_WINDOW_MS ? "soon" : "open";
}

type QuizLite = { id: number; dueAt: number | null; groupId: number | null; isTemplate: number; title: string };

/**
 * Which (quiz, student) pairs should get a reminder now: the quiz is due
 * within the window, the student is in its group, hasn't submitted and
 * hasn't been reminded. Keys in `submitted` / `alreadySent` are "quizId:studentId".
 */
export function remindersToSend(input: {
  now: number;
  quizzes: QuizLite[];
  members: Record<number, number[]>;
  submitted: Set<string>;
  alreadySent: Set<string>;
}) {
  const out: { quizId: number; studentId: number; title: string; dueAt: number }[] = [];
  for (const q of input.quizzes) {
    if (q.isTemplate || !q.groupId || deadlineState(q.dueAt, input.now) !== "soon") continue;
    for (const studentId of input.members[q.groupId] ?? []) {
      const key = `${q.id}:${studentId}`;
      if (input.submitted.has(key) || input.alreadySent.has(key)) continue;
      out.push({ quizId: q.id, studentId, title: q.title, dueAt: q.dueAt! });
    }
  }
  return out;
}
