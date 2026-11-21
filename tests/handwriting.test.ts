import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeAnswers } from "../shared/quiz-variants";
import { sanitizeAnswers, isDrawing } from "../shared/answers";
import { buildReview } from "../shared/review";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const open = { id: "o", type: "open", prompt: "Show", points: 2, imageUrl: "", options: [], correctIndexes: [], correctText: "", tolerance: 0, topic: "", difficulty: "", allowDrawing: true } as any;

test("a hand-written answer alone sends the work to the teacher", () => {
  assert.equal(gradeAnswers([open], { o: { answer: "", drawing: PNG } as any }).needsGrading, 1);
  assert.equal(gradeAnswers([open], { o: { answer: "" } }).needsGrading, 0);
});

test("answers keep only the answer and a valid PNG drawing", () => {
  const clean = sanitizeAnswers({
    o: { answer: "x = 2", drawing: PNG, evil: "<script>" },
    p: { answer: 3, drawing: "javascript:alert(1)" },
    q: "not an object",
  } as any);
  assert.deepEqual(clean, { o: { answer: "x = 2", drawing: PNG }, p: { answer: 3 } });
});

test("drawings must be PNG data and not too large", () => {
  assert.equal(isDrawing(PNG), true);
  assert.equal(isDrawing("data:image/svg+xml;base64,AAAA"), false);
  assert.equal(isDrawing("data:image/png;base64," + "A".repeat(2_000_000)), false);
});

test("the review carries the student's drawing and the teacher's pen marks", () => {
  const r = buildReview([open], {
    answers: JSON.stringify({ o: { answer: "", drawing: PNG } }), gradedPoints: "{}", comments: "{}",
    annotations: JSON.stringify({ o: PNG }), questionIds: "", needsGrading: 1, attemptNumber: 1,
  } as any, false);
  assert.equal(r[0].drawing, PNG);
  assert.equal(r[0].annotation, PNG);
  assert.equal(r[0].status, "pending");
});
