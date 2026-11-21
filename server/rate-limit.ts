import type { Request } from "express";

// Slows down password guessing and email spam. Counts live in the database so
// the limit holds across serverless instances; MemoryCounter is for tests.

export interface Counter {
  /** Adds one hit to `key` and returns the count in the current window. */
  hit(key: string, windowMs: number, now: number): Promise<{ count: number; resetAt: number }>;
  peek(key: string, now: number): Promise<{ count: number; resetAt: number }>;
  clear(key: string): Promise<void>;
}

export class MemoryCounter implements Counter {
  private m = new Map<string, { count: number; resetAt: number }>();
  async hit(key: string, windowMs: number, now: number) {
    const cur = this.m.get(key);
    const next = !cur || cur.resetAt <= now ? { count: 1, resetAt: now + windowMs } : { count: cur.count + 1, resetAt: cur.resetAt };
    this.m.set(key, next);
    return next;
  }
  async peek(key: string, now: number) {
    const cur = this.m.get(key);
    return !cur || cur.resetAt <= now ? { count: 0, resetAt: now } : cur;
  }
  async clear(key: string) { this.m.delete(key); }
}

export type LimitResult = { allowed: boolean; retryAfterSec: number };

/** Counts this attempt and says whether it is within `limit` per `windowMs`. */
export async function checkLimit(c: Counter, key: string, limit: number, windowMs: number, now = Date.now()): Promise<LimitResult> {
  const { count, resetAt } = await c.hit(key, windowMs, now);
  return { allowed: count <= limit, retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
}

/** Whether `key` is already over `limit`, without counting a new attempt. */
export async function isLimited(c: Counter, key: string, limit: number, now = Date.now()): Promise<LimitResult> {
  const { count, resetAt } = await c.peek(key, now);
  return { allowed: count < limit, retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
}

/** The visitor's address. On Vercel the edge sets x-forwarded-for; the first entry is the client. */
export function clientIp(req: Pick<Request, "headers" | "socket">): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  return first || req.socket?.remoteAddress || "unknown";
}
