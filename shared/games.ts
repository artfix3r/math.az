// Fun zone: game ids, score limits and the pure game logic, shared by the
// browser (to play) and the server (to accept scores). Every function takes a
// random source so tests can be deterministic.

export const GAMES = ["speed", "merge", "balance", "memory"] as const;
export type GameId = (typeof GAMES)[number];

/** Highest score a fair game can reach; anything above is rejected. */
export const MAX_SCORE: Record<GameId, number> = {
  speed: 400, // 60 seconds of answers, at most a few points each
  merge: 2_000_000,
  balance: 5_000,
  memory: 1_000,
};

export function isGame(x: unknown): x is GameId {
  return typeof x === "string" && (GAMES as readonly string[]).includes(x);
}

export function isValidScore(game: GameId, score: unknown): score is number {
  return Number.isInteger(score) && (score as number) >= 0 && (score as number) <= MAX_SCORE[game];
}

// Weeks start on Monday 00:00 in Baku (UTC+4, no daylight saving).
const BAKU_OFFSET_MS = 4 * 3600_000;
const DAY_MS = 86_400_000;
export function weekStart(now: number): number {
  const local = now + BAKU_OFFSET_MS;
  const dayStart = local - (((local % DAY_MS) + DAY_MS) % DAY_MS);
  const weekday = (new Date(dayStart).getUTCDay() + 6) % 7; // Monday = 0
  return dayStart - weekday * DAY_MS - BAKU_OFFSET_MS;
}

export type Rnd = () => number;
const int = (rnd: Rnd, lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = <T,>(rnd: Rnd, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];

// ---------------- Speed arithmetic ----------------
export type SpeedProblem = { text: string; answer: number; points: number };

/** level 0.. grows with the streak; every answer is a whole number. */
export function speedProblem(level: number, rnd: Rnd = Math.random): SpeedProblem {
  const ops = level < 2 ? ["+", "−"] : ["+", "−", "×", "÷"];
  const op = pick(rnd, ops);
  const big = Math.min(10 + level * 8, 99);
  if (op === "+") {
    const a = int(rnd, 1, big), b = int(rnd, 1, big);
    return { text: `${a} + ${b}`, answer: a + b, points: 1 + Math.floor(level / 3) };
  }
  if (op === "−") {
    const a = int(rnd, 2, big), b = int(rnd, 1, a);
    return { text: `${a} − ${b}`, answer: a - b, points: 1 + Math.floor(level / 3) };
  }
  const top = Math.min(5 + level, 12);
  const a = int(rnd, 2, top), b = int(rnd, 2, top);
  if (op === "×") return { text: `${a} × ${b}`, answer: a * b, points: 2 + Math.floor(level / 3) };
  return { text: `${a * b} ÷ ${a}`, answer: b, points: 2 + Math.floor(level / 3) };
}

// ---------------- Number merge (2048) ----------------
export type Board = number[][]; // 4×4, 0 = empty
export type Dir = "left" | "right" | "up" | "down";

export function emptyBoard(size = 4): Board {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function slideRow(row: number[]): { row: number[]; gained: number } {
  const tiles = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      gained += tiles[i] * 2;
      i++;
    } else out.push(tiles[i]);
  }
  while (out.length < row.length) out.push(0);
  return { row: out, gained };
}

const transpose = (b: Board): Board => b[0].map((_, c) => b.map((r) => r[c]));

export function slide(board: Board, dir: Dir): { board: Board; gained: number; moved: boolean } {
  let rows = dir === "up" || dir === "down" ? transpose(board) : board.map((r) => [...r]);
  const reverse = dir === "right" || dir === "down";
  let gained = 0;
  rows = rows.map((r) => {
    const res = slideRow(reverse ? [...r].reverse() : r);
    gained += res.gained;
    return reverse ? res.row.reverse() : res.row;
  });
  const next = dir === "up" || dir === "down" ? transpose(rows) : rows;
  const moved = next.some((r, i) => r.some((v, j) => v !== board[i][j]));
  return { board: next, gained, moved };
}

export function addTile(board: Board, rnd: Rnd = Math.random): Board {
  const empty: [number, number][] = [];
  board.forEach((r, i) => r.forEach((v, j) => { if (v === 0) empty.push([i, j]); }));
  if (!empty.length) return board;
  const [i, j] = pick(rnd, empty);
  const next = board.map((r) => [...r]);
  next[i][j] = rnd() < 0.9 ? 2 : 4;
  return next;
}

export function canMove(board: Board): boolean {
  return (["left", "right", "up", "down"] as Dir[]).some((d) => slide(board, d).moved);
}

// ---------------- Equation balance ----------------
/** a·x + b = c·x + d, plus how it is written. */
export type Equation = { left: string; right: string; x: number; points: number; a: number; b: number; c: number; d: number };

/** How far the scale tips for a guess: left minus right. Zero means balanced. */
export function imbalance(e: Equation, guess: number): number {
  return e.a * guess + e.b - (e.c * guess + e.d);
}

function term(a: number, v = "x") {
  return a === 1 ? v : a === -1 ? `−${v}` : `${a}${v}`;
}
function plus(b: number) {
  return b >= 0 ? ` + ${b}` : ` − ${-b}`;
}

/** Each level adds a step: x + a = b, ax = b, ax + b = c, ax + b = cx + d. */
export function equation(level: number, rnd: Rnd = Math.random): Equation {
  const x = int(rnd, level < 3 ? 1 : -9, level < 3 ? 12 : 15) || 4;
  const stage = Math.min(Math.floor(level / 2), 3);
  if (stage === 0) {
    const a = int(rnd, 1, 20);
    return { left: `x + ${a}`, right: String(x + a), x, points: 10, a: 1, b: a, c: 0, d: x + a };
  }
  if (stage === 1) {
    const a = int(rnd, 2, 9);
    return { left: term(a), right: String(a * x), x, points: 20, a, b: 0, c: 0, d: a * x };
  }
  if (stage === 2) {
    const a = int(rnd, 2, 9), b = int(rnd, -15, 15) || 3;
    return { left: term(a) + plus(b), right: String(a * x + b), x, points: 30, a, b, c: 0, d: a * x + b };
  }
  const c = int(rnd, 1, 5), a = c + int(rnd, 1, 5);
  const b = int(rnd, -12, 12) || 5;
  const d = a * x + b - c * x;
  return { left: term(a) + plus(b), right: term(c) + plus(d), x, points: 50, a, b, c, d };
}

// ---------------- Memory pairs ----------------
export type Card = { id: number; pair: number; label: string };

// Two faces of the same value; every value appears in one pair only, so a
// match is never ambiguous. Plain text, so labels render anywhere.
const PAIR_POOL: [string, string][] = [
  ["7 × 8", "56"], ["6 × 9", "54"], ["12 × 12", "144"], ["½", "0.5"], ["¼", "25%"],
  ["¾", "0.75"], ["3²", "9"], ["2⁵", "32"], ["√49", "7"], ["√64", "8"], ["10%", "0.1"],
  ["⅕", "20%"], ["15 + 27", "42"], ["100 − 37", "63"], ["5³", "125"], ["84 ÷ 7", "12"],
];

export function memoryDeck(pairs = 8, rnd: Rnd = Math.random): Card[] {
  const pool = [...PAIR_POOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const chosen = pool.slice(0, pairs);
  const cards: Card[] = [];
  chosen.forEach(([a, b], p) => { cards.push({ id: 0, pair: p, label: a }, { id: 0, pair: p, label: b }); });
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards.map((c, i) => ({ ...c, id: i }));
}

/** Fewer moves and less time score higher; a perfect fast game is near 1000. */
export function memoryScore(pairs: number, moves: number, seconds: number): number {
  const extraMoves = Math.max(0, moves - pairs);
  return Math.max(0, Math.min(MAX_SCORE.memory, 1000 - extraMoves * 25 - Math.max(0, seconds - 15) * 3));
}
