import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVariant, gradeAnswers, answersToOriginal } from "../shared/quiz-variants";
import type { Question } from "../shared/schema";

const mk = (i: number, over: Partial<Question> = {}): Question => ({
  id: `q${i}`, type: "mcq", prompt: `Q${i}`, imageUrl: "", options: ["a", "b", "c", "d"], correctIndex: 1,
  correctIndexes: [], correctText: "", tolerance: 0, points: 1, ...over,
});
const twenty = Array.from({ length: 20 }, (_, i) => mk(i + 1));

test("with no picking or shuffling, every question is used in order", () => {
  const v = buildVariant(twenty, { pickCount: 0, shuffle: false }, 7);
  assert.deepEqual(v.map((q) => q.id), twenty.map((q) => q.id));
});

test("pickCount gives each student that many questions", () => {
  assert.equal(buildVariant(twenty, { pickCount: 10, shuffle: false }, 7).length, 10);
});

test("the same student always gets the same variant", () => {
  const a = buildVariant(twenty, { pickCount: 10, shuffle: true }, 42);
  const b = buildVariant(twenty, { pickCount: 10, shuffle: true }, 42);
  assert.deepEqual(a, b);
});

test("different students get different variants", () => {
  const ids = (seed: number) => buildVariant(twenty, { pickCount: 10, shuffle: true }, seed).map((q) => q.id).join();
  const distinct = new Set([1, 2, 3, 4, 5].map(ids));
  assert.ok(distinct.size >= 4, `only ${distinct.size} distinct variants`);
});

test("shuffled options keep the right answer pointing at the same text", () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const [q] = buildVariant([mk(1, { options: ["w", "x", "y", "z"], correctIndex: 2 })], { pickCount: 0, shuffle: true }, seed);
    assert.equal(q.options![q.correctIndex!], "y");
  }
});

test("shuffled multi-select keeps all right answers", () => {
  const src = mk(1, { type: "multi_select", options: ["p", "q", "r", "s"], correctIndexes: [0, 3] });
  const [q] = buildVariant([src], { pickCount: 0, shuffle: true }, 9);
  assert.deepEqual(q.correctIndexes!.map((i) => q.options![i]).sort(), ["p", "s"]);
});

test("true/false options are never shuffled", () => {
  const [q] = buildVariant([mk(1, { type: "true_false", options: [], correctIndex: 0 })], { pickCount: 0, shuffle: true }, 3);
  assert.equal(q.correctIndex, 0);
});

test("grading scores only the questions the student was given", () => {
  const v = buildVariant(twenty, { pickCount: 5, shuffle: false }, 1);
  const answers = Object.fromEntries(v.map((q) => [q.id, { answer: q.correctIndex! }]));
  assert.deepEqual(gradeAnswers(v, answers), { score: 5, maxScore: 5, needsGrading: 0 });
});

test("answers to shuffled options are saved against the original option order", () => {
  const original = [mk(1, { options: ["w", "x", "y", "z"], correctIndex: 2 })];
  const [q] = buildVariant(original, { pickCount: 0, shuffle: true }, 5);
  const chosen = q.options!.indexOf("y");
  const saved = answersToOriginal(original, [q], { q1: { answer: chosen } });
  assert.deepEqual(saved, { q1: { answer: 2 } });
});

test("multi-select answers are mapped back too", () => {
  const original = [mk(1, { type: "multi_select", options: ["p", "q", "r", "s"], correctIndexes: [0, 3] })];
  const [q] = buildVariant(original, { pickCount: 0, shuffle: true }, 11);
  const chosen = ["p", "s"].map((t) => q.options!.indexOf(t)).join(",");
  assert.deepEqual(answersToOriginal(original, [q], { q1: { answer: chosen } }), { q1: { answer: "0,3" } });
});

test("existing grading rules still hold: numeric tolerance, fill-in case, open needs grading", () => {
  const qs = [
    mk(1, { type: "numeric", correctNumber: 3.14, tolerance: 0.01, points: 2 }),
    mk(2, { type: "fill_blank", correctText: "Bakı" }),
    mk(3, { type: "open", points: 3 }),
  ];
  const r = gradeAnswers(qs, { q1: { answer: "3.145" }, q2: { answer: " bakı " }, q3: { answer: "x=2" } });
  assert.deepEqual(r, { score: 3, maxScore: 6, needsGrading: 1 });
});
