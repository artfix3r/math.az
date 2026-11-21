import { test } from "node:test";
import assert from "node:assert/strict";
import { nextUp, latestResult, teacherAgenda } from "../shared/dashboard";

const H = 3600_000;
const D = 24 * H;
const now = Date.UTC(2026, 10, 21, 12, 0);

const q = (id: number, over: Record<string, unknown> = {}) => ({
  id, title: `Q${id}`, groupId: 1, dueAt: null as number | null, startAt: now - D, durationMinutes: 30, submission: null as any, ...over,
});

test("nextUp picks the nearest-due quiz the student hasn't handed in", () => {
  const list = [q(1, { dueAt: now + 3 * D }), q(2, { dueAt: now + 5 * H }), q(3, { dueAt: now + 2 * H, submission: { score: 1, maxScore: 2, needsGrading: 0 } })];
  assert.equal(nextUp(list, now)?.id, 2);
});

test("nextUp skips closed deadlines and quizzes that haven't opened", () => {
  const list = [q(1, { dueAt: now - H }), q(2, { startAt: now + D })];
  assert.equal(nextUp(list, now), null);
});

test("nextUp falls back to an open quiz with no deadline", () => {
  const list = [q(1), q(2, { dueAt: now - H })];
  assert.equal(nextUp(list, now)?.id, 1);
});

test("latestResult returns the most recent submission", () => {
  const subs = [
    { quizId: 1, quizTitle: "A", score: 3, maxScore: 5, needsGrading: 0, submittedAt: now - 2 * D },
    { quizId: 2, quizTitle: "B", score: 8, maxScore: 10, needsGrading: 0, submittedAt: now - H },
  ];
  assert.equal(latestResult(subs)?.quizId, 2);
  assert.equal(latestResult([]), null);
});

test("teacherAgenda lists quizzes to grade and homework due in the next 7 days with missing counts", () => {
  const quizzes = [
    q(1, { dueAt: now + 2 * D }),
    q(2, { dueAt: now + 10 * D }),
    q(3, { dueAt: now - D }),
    q(4, { groupId: null }),
  ];
  const perQuiz = [
    { quizId: 1, submissions: 2, needsGrading: 1 },
    { quizId: 2, submissions: 0, needsGrading: 0 },
    { quizId: 3, submissions: 5, needsGrading: 2 },
  ];
  const groups = [{ id: 1, name: "9A", memberCount: 6 }];
  const a = teacherAgenda({ quizzes, perQuiz, groups, now });
  assert.deepEqual(a.toGrade.map((x) => [x.id, x.count]), [[3, 2], [1, 1]]);
  assert.deepEqual(a.dueThisWeek.map((x) => [x.id, x.submitted, x.missing, x.groupName]), [[1, 2, 4, "9A"]]);
});
