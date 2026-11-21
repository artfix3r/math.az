// What the dashboard shows first. Pure functions so they can be tested.

type Sub = { score: number; maxScore: number; needsGrading: number } | null;
type StudentQuizLite = { id: number; title: string; dueAt: number | null; startAt: number | null; submission: Sub };

/** The homework a student should do next: nearest deadline first, then any open quiz. */
export function nextUp<T extends StudentQuizLite>(quizzes: T[], now: number): T | null {
  const open = quizzes.filter((q) => !q.submission && (!q.startAt || q.startAt <= now) && (!q.dueAt || q.dueAt >= now));
  if (!open.length) return null;
  const withDue = open.filter((q) => q.dueAt).sort((a, b) => a.dueAt! - b.dueAt!);
  return withDue[0] ?? open[0];
}

type MySub = { quizId: number; submittedAt: number };
export function latestResult<T extends MySub>(subs: T[]): T | null {
  if (!subs.length) return null;
  return [...subs].sort((a, b) => b.submittedAt - a.submittedAt)[0];
}

type TeacherQuizLite = { id: number; title: string; groupId: number | null; dueAt: number | null };
type PerQuiz = { quizId: number; submissions: number; needsGrading: number };
type GroupLite = { id: number; name: string; memberCount: number };

const WEEK = 7 * 24 * 3600_000;

export function teacherAgenda(input: { quizzes: TeacherQuizLite[]; perQuiz: PerQuiz[]; groups: GroupLite[]; now: number }) {
  const { quizzes, perQuiz, groups, now } = input;
  const stats = new Map(perQuiz.map((p) => [p.quizId, p]));
  const group = new Map(groups.map((g) => [g.id, g]));

  const toGrade = quizzes
    .map((q) => ({ id: q.id, title: q.title, count: stats.get(q.id)?.needsGrading ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  const dueThisWeek = quizzes
    .filter((q) => q.groupId != null && q.dueAt && q.dueAt >= now && q.dueAt - now <= WEEK)
    .sort((a, b) => a.dueAt! - b.dueAt!)
    .map((q) => {
      const g = group.get(q.groupId!);
      const submitted = stats.get(q.id)?.submissions ?? 0;
      return {
        id: q.id, title: q.title, dueAt: q.dueAt!, groupName: g?.name ?? "",
        submitted, missing: Math.max(0, (g?.memberCount ?? 0) - submitted),
      };
    });

  return { toGrade, dueThisWeek };
}
