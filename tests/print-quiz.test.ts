import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrintModel } from "../client/src/lib/print-quiz";
import type { Question } from "../shared/schema";

const q = (over: Partial<Question>): Question => ({
  id: Math.random().toString(36).slice(2), type: "mcq", prompt: "?", imageUrl: "", options: [],
  correctIndexes: [], correctText: "", tolerance: 0, points: 1, ...over,
});

const labels = { true: "True", false: "False" };

test("multiple-choice options are lettered A, B, C…", () => {
  const m = buildPrintModel([q({ options: ["1", "2", "3"], correctIndex: 1 })], labels);
  assert.deepEqual(m.items[0].options.map((o) => o.letter), ["A", "B", "C"]);
});

test("questions are numbered from 1 and keep their points", () => {
  const m = buildPrintModel([q({ points: 2 }), q({ points: 3 })], labels);
  assert.deepEqual(m.items.map((i) => [i.number, i.points]), [[1, 2], [2, 3]]);
  assert.equal(m.totalPoints, 5);
});

test("the answer key gives the letter for multiple choice", () => {
  const m = buildPrintModel([q({ options: ["a", "b", "c"], correctIndex: 2 })], labels);
  assert.deepEqual(m.answerKey, [{ number: 1, answer: "C" }]);
});

test("the answer key lists all correct letters for multi-select", () => {
  const m = buildPrintModel([q({ type: "multi_select", options: ["a", "b", "c"], correctIndexes: [2, 0] })], labels);
  assert.equal(m.answerKey[0].answer, "A, C");
});

test("true/false questions show both choices and the right one in the key", () => {
  const m = buildPrintModel([q({ type: "true_false", correctIndex: 1 })], labels);
  assert.deepEqual(m.items[0].options.map((o) => o.text), ["True", "False"]);
  assert.equal(m.answerKey[0].answer, "B");
});

test("numeric answers show the tolerance in the key", () => {
  const m = buildPrintModel([q({ type: "numeric", correctNumber: 3.14, tolerance: 0.01 })], labels);
  assert.equal(m.answerKey[0].answer, "3.14 ± 0.01");
});

test("open and photo questions get answer space and no key entry", () => {
  const m = buildPrintModel([q({ type: "open" }), q({ type: "photo" })], labels);
  assert.deepEqual(m.items.map((i) => i.answerLines), [6, 6]);
  assert.deepEqual(m.answerKey.map((k) => k.answer), ["—", "—"]);
});
