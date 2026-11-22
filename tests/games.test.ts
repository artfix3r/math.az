import { test } from "node:test";
import assert from "node:assert/strict";
import {
  speedProblem, slide, addTile, canMove, emptyBoard, equation, memoryDeck, memoryScore,
  weekStart, isValidScore, isGame, MAX_SCORE, imbalance,
} from "../shared/games";
import { forumQuestionInput, forumAnswerInput, shortName, isForumImage } from "../shared/forum";

// Small seeded generator so every run checks the same cases.
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

test("speed problems always have whole, non-negative answers that match the text", () => {
  const rnd = seeded(1);
  for (let level = 0; level < 15; level++) {
    for (let i = 0; i < 200; i++) {
      const p = speedProblem(level, rnd);
      assert.ok(Number.isInteger(p.answer) && p.answer >= 0, p.text);
      const [a, op, b] = p.text.split(" ");
      const v = op === "+" ? +a + +b : op === "−" ? +a - +b : op === "×" ? +a * +b : +a / +b;
      assert.equal(v, p.answer, p.text);
    }
  }
});

test("early speed levels use only + and −", () => {
  const rnd = seeded(2);
  for (let i = 0; i < 100; i++) assert.match(speedProblem(0, rnd).text, /[+−]/);
});

test("merge: equal tiles join once per move and score their sum", () => {
  const b = [[2, 2, 2, 2], [4, 0, 4, 8], [0, 0, 0, 0], [2, 0, 0, 2]];
  const r = slide(b, "left");
  assert.deepEqual(r.board, [[4, 4, 0, 0], [8, 8, 0, 0], [0, 0, 0, 0], [4, 0, 0, 0]]);
  assert.equal(r.gained, 4 + 4 + 8 + 4);
  assert.equal(r.moved, true);
  assert.deepEqual(slide(b, "right").board[0], [0, 0, 4, 4]);
  assert.deepEqual(slide([[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [4, 0, 0, 0]], "up").board.map((r) => r[0]), [4, 8, 0, 0]);
});

test("merge: a move that changes nothing is not a move, and a full locked board is game over", () => {
  const locked = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
  assert.equal(slide(locked, "left").moved, false);
  assert.equal(canMove(locked), false);
  assert.equal(canMove(emptyBoard()), false);
  const one = addTile(emptyBoard(), seeded(3));
  assert.equal(one.flat().filter((v) => v).length, 1);
  assert.equal(canMove(one), true);
});

test("balance: the stated x solves every generated equation", () => {
  const rnd = seeded(4);
  const evalSide = (s: string, x: number) =>
    Function(`return ${s.replace(/−/g, "-").replace(/(\d)x/g, "$1*x").replace(/x/g, `(${x})`)}`)() as number;
  for (let level = 0; level < 12; level++) {
    for (let i = 0; i < 100; i++) {
      const e = equation(level, rnd);
      assert.equal(evalSide(e.left, e.x), evalSide(e.right, e.x), `${e.left} = ${e.right}, x=${e.x}`);
      assert.equal(imbalance(e, e.x), 0);
      assert.equal(imbalance(e, e.x + 1), evalSide(e.left, e.x + 1) - evalSide(e.right, e.x + 1));
    }
  }
});

test("memory deck has every value in exactly one pair", () => {
  const deck = memoryDeck(8, seeded(5));
  assert.equal(deck.length, 16);
  assert.equal(new Set(deck.map((c) => c.label)).size, 16);
  for (let p = 0; p < 8; p++) assert.equal(deck.filter((c) => c.pair === p).length, 2);
  assert.equal(memoryScore(8, 8, 10), 1000);
  assert.ok(memoryScore(8, 20, 60) < memoryScore(8, 12, 30));
  assert.equal(memoryScore(8, 200, 900), 0);
});

test("weeks start Monday 00:00 Baku time", () => {
  // Sunday 22 Nov 2026 21:00 Baku = 17:00 UTC → week began Mon 16 Nov 00:00 Baku = 15 Nov 20:00 UTC.
  assert.equal(weekStart(Date.UTC(2026, 10, 22, 17, 0)), Date.UTC(2026, 10, 15, 20, 0));
  // Monday 23 Nov 00:30 Baku starts a new week.
  assert.equal(weekStart(Date.UTC(2026, 10, 22, 20, 30)), Date.UTC(2026, 10, 22, 20, 0));
});

test("scores must be whole numbers within each game's limit", () => {
  assert.equal(isGame("merge"), true);
  assert.equal(isGame("chess"), false);
  assert.equal(isValidScore("speed", 42), true);
  assert.equal(isValidScore("speed", MAX_SCORE.speed + 1), false);
  assert.equal(isValidScore("memory", -1), false);
  assert.equal(isValidScore("memory", 1.5), false);
  assert.equal(isValidScore("memory", "900"), false);
});

test("forum input: titles need substance, images must be real image data", () => {
  assert.equal(forumQuestionInput.safeParse({ title: "hi" }).success, false);
  assert.equal(forumQuestionInput.safeParse({ title: "How do I solve 2x+3=7?" }).success, true);
  assert.equal(forumQuestionInput.safeParse({ title: "How do I solve this?", image: "javascript:alert(1)" }).success, false);
  assert.equal(forumQuestionInput.safeParse({ title: "How do I solve this?", image: "data:image/svg+xml;base64,PHN2Zz4=" }).success, false);
  assert.equal(isForumImage("data:image/jpeg;base64,/9j/4AAQ"), true);
  assert.equal(forumAnswerInput.safeParse({ body: "   " }).success, false);
  assert.equal(forumAnswerInput.safeParse({ body: "x = 2" }).success, true);
});

test("forum shows first name and initial only", () => {
  assert.equal(shortName("Aysel Quliyeva"), "Aysel Q.");
  assert.equal(shortName("Leyla"), "Leyla");
  assert.equal(shortName("  "), "—");
});
