// What a student may send as answers: { answer, drawing? } per question.
// A drawing is a hand-written solution, stored as a PNG data URL.

export type StoredAnswer = { answer: string | number; drawing?: string };

/** About 1 MB of base64; a full-page drawing is usually 30–150 kB. */
export const MAX_DRAWING_CHARS = 1_400_000;

export function isDrawing(v: unknown): v is string {
  return typeof v === "string" && v.length <= MAX_DRAWING_CHARS && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(v);
}

export function sanitizeAnswers(raw: unknown): Record<string, StoredAnswer> {
  const out: Record<string, StoredAnswer> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw as Record<string, any>)) {
    if (!v || typeof v !== "object") continue;
    const answer = typeof v.answer === "number" || typeof v.answer === "string" ? v.answer : "";
    const a: StoredAnswer = { answer: typeof answer === "string" ? answer.slice(0, 20000) : answer };
    if (isDrawing(v.drawing)) a.drawing = v.drawing;
    out[id] = a;
  }
  return out;
}
