import type { Question } from "./schema";
import { gradeAnswers } from "./quiz-variants";

// A student's progress: score per quiz over time, and points per topic with
// a strength level and trend. Shared by the API (student / teacher / parent).

type QuizLite = { id: number; title: string; questions: string };
type SubLite = {
  quizId: number; submittedAt: number; answers: string; gradedPoints: string;
  questionIds: string; score: number; maxScore: number; needsGrading: number;
};

export type TopicLevel = "strong" | "ok" | "weak";
export type Trend = "up" | "down" | "steady";
export type TopicProgress = { topic: string; earned: number; possible: number; percent: number; level: TopicLevel; trend: Trend };
export type ProgressReport = {
  quizCount: number;
  averagePercent: number;
  timeline: { quizId: number; title: string; submittedAt: number; percent: number; pending: boolean }[];
  topics: TopicProgress[];
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const level = (p: number): TopicLevel => (p >= 80 ? "strong" : p >= 50 ? "ok" : "weak");
const parse = <T,>(s: string, fallback: T): T => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };

/** Points earned on one question, or null if it isn't graded yet. */
function pointsFor(q: Question, answer: { answer: string | number } | undefined, graded: Record<string, number>): number | null {
  if (q.id in graded) return Number(graded[q.id]) || 0;
  if (q.type === "open" || q.type === "photo") return null; // waits for the teacher
  return gradeAnswers([q], answer ? { [q.id]: answer } : {}).score;
}

export function computeProgress(quizzes: QuizLite[], submissions: SubLite[]): ProgressReport {
  const byId = new Map(quizzes.map((q) => [q.id, q]));
  const subs = submissions.filter((s) => byId.has(s.quizId)).sort((a, b) => a.submittedAt - b.submittedAt);

  // Per topic, keep each submission's (earned, possible) in date order for the trend.
  const perTopic = new Map<string, { earned: number; possible: number; series: number[] }>();
  const timeline: ProgressReport["timeline"] = [];

  for (const s of subs) {
    const quiz = byId.get(s.quizId)!;
    const shown = parse<string[] | null>(s.questionIds, null);
    const questions = parse<Question[]>(quiz.questions, []).filter((q) => !shown || shown.includes(q.id));
    const answers = parse<Record<string, { answer: string | number }>>(s.answers, {});
    const graded = parse<Record<string, number>>(s.gradedPoints, {});

    const thisSub = new Map<string, { e: number; p: number }>();
    for (const q of questions) {
      const got = pointsFor(q, answers[q.id], graded);
      if (got === null) continue;
      const key = q.topic ?? "";
      const cur = thisSub.get(key) ?? { e: 0, p: 0 };
      cur.e += got; cur.p += q.points;
      thisSub.set(key, cur);
    }
    thisSub.forEach(({ e, p }, topic) => {
      const t = perTopic.get(topic) ?? { earned: 0, possible: 0, series: [] };
      t.earned += e; t.possible += p; t.series.push(p ? e / p : 0);
      perTopic.set(topic, t);
    });

    timeline.push({ quizId: s.quizId, title: quiz.title, submittedAt: s.submittedAt, percent: pct(s.score, s.maxScore), pending: !!s.needsGrading });
  }

  const topics: TopicProgress[] = Array.from(perTopic, ([topic, t]) => {
    const percent = pct(t.earned, t.possible);
    return { topic, earned: t.earned, possible: t.possible, percent, level: level(percent), trend: trendOf(t.series) };
  }).sort((a, b) => a.percent - b.percent || a.topic.localeCompare(b.topic));

  const averagePercent = timeline.length ? Math.round(timeline.reduce((s, x) => s + x.percent, 0) / timeline.length) : 0;
  return { quizCount: timeline.length, averagePercent, timeline, topics };
}

// Compare the newer half of results with the older half (needs 3+ results).
function trendOf(series: number[]): Trend {
  if (series.length < 3) return "steady";
  const half = Math.floor(series.length / 2);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const diff = avg(series.slice(-half)) - avg(series.slice(0, half));
  return diff > 0.1 ? "up" : diff < -0.1 ? "down" : "steady";
}
