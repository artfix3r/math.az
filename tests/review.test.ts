import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReview, canRevealAnswers } from "../shared/review";

const Q = (o: any) => ({ imageUrl: "", options: [], correctIndexes: [], correctText: "", tolerance: 0, points: 1, topic: "", difficulty: "", ...o });
const questions = [
  Q({ id: "a", type: "mcq", prompt: "2+2", options: ["3", "4"], correctIndex: 1 }),
  Q({ id: "b", type: "numeric", prompt: "x", correctNumber: 5, points: 2 }),
  Q({ id: "c", type: "open", prompt: "Explain", points: 3 }),
  Q({ id: "d", type: "true_false", prompt: "1>2", correctIndex: 1 }),
];
const sub = (o: any = {}) => ({
  answers: JSON.stringify({ a: { answer: 1 }, b: { answer: "4" }, c: { answer: "because" } }),
  gradedPoints: "{}", comments: "{}", feedback: "", questionIds: "", needsGrading: 1, attemptNumber: 1, ...o,
});

test("auto-marked questions show correct and wrong; open answers wait for the teacher", () => {
  const r = buildReview(questions as any, sub(), false);
  assert.deepEqual(r.map((x) => [x.id, x.status, x.awarded]), [["a", "correct", 1], ["b", "wrong", 0], ["c", "pending", 0], ["d", "wrong", 0]]);
  assert.equal(r[3].answer, "");
});

test("the teacher's points and comments override the automatic marking", () => {
  const r = buildReview(questions as any, sub({
    needsGrading: 0,
    gradedPoints: JSON.stringify({ a: 1, b: 2, c: 2, d: 0 }),
    comments: JSON.stringify({ b: "Rounding is fine here", c: "Good start, show the last step" }),
  }), false);
  assert.deepEqual(r.map((x) => [x.id, x.status, x.awarded]), [["a", "correct", 1], ["b", "correct", 2], ["c", "partial", 2], ["d", "wrong", 0]]);
  assert.equal(r[2].comment, "Good start, show the last step");
});

test("correct answers are hidden unless allowed", () => {
  const hidden = buildReview(questions as any, sub(), false);
  assert.equal(hidden[0].correct, undefined);
  const shown = buildReview(questions as any, sub(), true);
  assert.deepEqual(shown[0].correct, { index: 1 });
  assert.deepEqual(shown[1].correct, { number: 5, tolerance: 0 });
  assert.equal(shown[2].correct, undefined);
});

test("only the questions this student was given are listed", () => {
  const r = buildReview(questions as any, sub({ questionIds: JSON.stringify(["c", "a"]) }), false);
  assert.deepEqual(r.map((x) => x.id), ["a", "c"]);
});

test("answers are revealed once graded and either the deadline passed or no attempts are left", () => {
  const now = 1000;
  assert.equal(canRevealAnswers({ dueAt: 500, maxAttempts: 3 }, { needsGrading: 0, attemptNumber: 1 }, now), true);
  assert.equal(canRevealAnswers({ dueAt: null, maxAttempts: 1 }, { needsGrading: 0, attemptNumber: 1 }, now), true);
  assert.equal(canRevealAnswers({ dueAt: null, maxAttempts: 0 }, { needsGrading: 0, attemptNumber: 4 }, now), false);
  assert.equal(canRevealAnswers({ dueAt: 2000, maxAttempts: 3 }, { needsGrading: 0, attemptNumber: 1 }, now), false);
  assert.equal(canRevealAnswers({ dueAt: 500, maxAttempts: 1 }, { needsGrading: 1, attemptNumber: 1 }, now), false);
});
