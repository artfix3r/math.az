import { test } from "node:test";
import assert from "node:assert/strict";
import { computeProgress } from "../shared/progress";
import type { Question } from "../shared/schema";

const mcq = (id: string, topic: string, points = 1): Question => ({
  id, type: "mcq", prompt: id, imageUrl: "", options: ["a", "b"], correctIndex: 1, correctIndexes: [],
  correctText: "", tolerance: 0, points, topic, difficulty: "",
});
const quiz = (id: number, title: string, questions: Question[]) => ({ id, title, questions: JSON.stringify(questions) });
const sub = (quizId: number, submittedAt: number, answers: Record<string, number | string>, extra: Partial<{ gradedPoints: string; questionIds: string; score: number; maxScore: number; needsGrading: number }> = {}) => ({
  quizId, submittedAt, answers: JSON.stringify(Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, { answer: v }]))),
  gradedPoints: "{}", questionIds: "", score: 0, maxScore: 0, needsGrading: 0, ...extra,
});

test("points are added up per topic", () => {
  const q1 = quiz(1, "A", [mcq("f1", "Kəsrlər"), mcq("f2", "Kəsrlər"), mcq("g1", "Həndəsə")]);
  const p = computeProgress([q1], [sub(1, 100, { f1: 1, f2: 0, g1: 1 })]);
  const t = Object.fromEntries(p.topics.map((x) => [x.topic, [x.earned, x.possible, x.percent]]));
  assert.deepEqual(t, { "Kəsrlər": [1, 2, 50], "Həndəsə": [1, 1, 100] });
});

test("questions without a topic are grouped together", () => {
  const p = computeProgress([quiz(1, "A", [mcq("x", "")])], [sub(1, 1, { x: 1 })]);
  assert.equal(p.topics[0].topic, "");
});

test("topics are labelled strong, ok or needs work", () => {
  const qs = [mcq("a1", "A"), mcq("b1", "B"), mcq("b2", "B"), mcq("c1", "C"), mcq("c2", "C"), mcq("c3", "C")];
  const p = computeProgress([quiz(1, "Q", qs)], [sub(1, 1, { a1: 1, b1: 1, b2: 0, c1: 0, c2: 0, c3: 1 })]);
  const level = Object.fromEntries(p.topics.map((x) => [x.topic, x.level]));
  assert.deepEqual(level, { A: "strong", B: "ok", C: "weak" });
});

test("weakest topics come first", () => {
  const qs = [mcq("a1", "A"), mcq("c1", "C")];
  const p = computeProgress([quiz(1, "Q", qs)], [sub(1, 1, { a1: 1, c1: 0 })]);
  assert.deepEqual(p.topics.map((t) => t.topic), ["C", "A"]);
});

test("open questions count only after the teacher grades them", () => {
  const open: Question = { ...mcq("o", "Tənliklər", 4), type: "open" };
  const q = quiz(1, "Q", [open]);
  const ungraded = computeProgress([q], [sub(1, 1, { o: "x=2" }, { needsGrading: 1 })]);
  assert.equal(ungraded.topics.length, 0);
  const graded = computeProgress([q], [sub(1, 1, { o: "x=2" }, { gradedPoints: JSON.stringify({ o: 3 }) })]);
  assert.deepEqual([graded.topics[0].earned, graded.topics[0].possible], [3, 4]);
});

test("only questions the student was given are counted", () => {
  const q = quiz(1, "Q", [mcq("a", "A"), mcq("b", "B")]);
  const p = computeProgress([q], [sub(1, 1, { a: 1 }, { questionIds: JSON.stringify(["a"]) })]);
  assert.deepEqual(p.topics.map((t) => t.topic), ["A"]);
});

test("the timeline lists each quiz's percentage in date order", () => {
  const qa = quiz(1, "First", [mcq("a", "A"), mcq("b", "A")]);
  const qb = quiz(2, "Second", [mcq("c", "A")]);
  const p = computeProgress([qa, qb], [sub(2, 200, { c: 1 }, { score: 1, maxScore: 1 }), sub(1, 100, { a: 1, b: 0 }, { score: 1, maxScore: 2 })]);
  assert.deepEqual(p.timeline.map((x) => [x.title, x.percent]), [["First", 50], ["Second", 100]]);
});

test("a topic's trend compares recent results with earlier ones", () => {
  const quizzes = [1, 2, 3, 4].map((i) => quiz(i, `Q${i}`, [mcq(`q${i}a`, "A"), mcq(`q${i}b`, "A")]));
  const up = computeProgress(quizzes, [
    sub(1, 1, { q1a: 0, q1b: 0 }), sub(2, 2, { q2a: 0, q2b: 1 }), sub(3, 3, { q3a: 1, q3b: 1 }), sub(4, 4, { q4a: 1, q4b: 1 }),
  ]);
  assert.equal(up.topics[0].trend, "up");
  const flat = computeProgress(quizzes.slice(0, 2), [sub(1, 1, { q1a: 1, q1b: 0 }), sub(2, 2, { q2a: 1, q2b: 0 })]);
  assert.equal(flat.topics[0].trend, "steady");
});

test("the overall average is the average of quiz percentages", () => {
  const qa = quiz(1, "A", [mcq("a", "A")]);
  const qb = quiz(2, "B", [mcq("b", "A")]);
  const p = computeProgress([qa, qb], [sub(1, 1, {}, { score: 0, maxScore: 1 }), sub(2, 2, {}, { score: 1, maxScore: 1 })]);
  assert.equal(p.averagePercent, 50);
  assert.equal(p.quizCount, 2);
});
