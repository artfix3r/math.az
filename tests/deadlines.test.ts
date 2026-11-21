import { test } from "node:test";
import assert from "node:assert/strict";
import { deadlineState, remindersToSend, REMINDER_WINDOW_MS } from "../shared/deadlines";

const H = 3600_000;
const now = Date.UTC(2026, 10, 21, 12, 0);

test("no due date means no deadline", () => {
  assert.equal(deadlineState(null, now), "none");
});

test("more than a day left is 'open'", () => {
  assert.equal(deadlineState(now + 30 * H, now), "open");
});

test("less than a day left is 'soon'", () => {
  assert.equal(deadlineState(now + 5 * H, now), "soon");
});

test("past the due date is 'closed'", () => {
  assert.equal(deadlineState(now - 1, now), "closed");
});

const quiz = (id: number, dueAt: number | null, groupId = 1) => ({ id, dueAt, groupId, isTemplate: 0, title: `Q${id}` });

test("students who haven't submitted get a reminder when the deadline is within the window", () => {
  const r = remindersToSend({
    now,
    quizzes: [quiz(1, now + 10 * H)],
    members: { 1: [11, 12, 13] },
    submitted: new Set(["1:12"]),
    alreadySent: new Set(),
  });
  assert.deepEqual(r.map((x) => [x.quizId, x.studentId]), [[1, 11], [1, 13]]);
});

test("a reminder is never sent twice", () => {
  const r = remindersToSend({
    now, quizzes: [quiz(1, now + 10 * H)], members: { 1: [11] }, submitted: new Set(), alreadySent: new Set(["1:11"]),
  });
  assert.equal(r.length, 0);
});

test("no reminders far before the deadline, after it, or for quizzes without one", () => {
  const r = remindersToSend({
    now,
    quizzes: [quiz(1, now + REMINDER_WINDOW_MS + H), quiz(2, now - H), quiz(3, null)],
    members: { 1: [11] }, submitted: new Set(), alreadySent: new Set(),
  });
  assert.equal(r.length, 0);
});
