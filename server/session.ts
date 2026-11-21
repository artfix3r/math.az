import type { Request, Response } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Stateless signed-cookie sessions.
//
// The cookie holds "<userId>.<expiresAtMs>.<signature>", where the signature is
// an HMAC-SHA256 of "<userId>.<expiresAtMs>" keyed with SESSION_SECRET. The
// browser cannot read it (httpOnly) and cannot forge it without the secret, so
// the server can trust the user id inside. No session table is needed, which
// keeps this working on serverless hosts.

export const SESSION_COOKIE = "mathaz_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const isProd = process.env.NODE_ENV === "production";

function resolveSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (isProd) {
    throw new Error("SESSION_SECRET is required in production (at least 32 characters)");
  }
  console.warn(
    "[session] SESSION_SECRET not set (or shorter than 32 chars); using a random dev secret. " +
      "Sessions will reset whenever the server restarts.",
  );
  return randomBytes(32).toString("hex");
}

const SECRET = resolveSecret();

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) {
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

/** The signed-in user id and when the session was issued, or undefined. */
export function readSession(req: Request): { userId: number; issuedAt: number } | undefined {
  const userId = readSessionUserId(req);
  if (!userId) return undefined;
  const exp = Number(parseCookies(req.headers.cookie)[SESSION_COOKIE].split(".")[1]);
  return { userId, issuedAt: exp - SESSION_TTL_MS };
}

/** Returns the signed-in user id from the session cookie, or undefined. */
export function readSessionUserId(req: Request): number | undefined {
  const raw = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!raw) return undefined;
  const parts = raw.split(".");
  if (parts.length !== 3) return undefined;
  const [uid, exp, sig] = parts;
  const expected = sign(`${uid}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return undefined;
  const id = Number(uid);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function cookieAttrs(maxAgeSec: number): string {
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    isProd ? "Secure" : "",
    `Max-Age=${maxAgeSec}`,
  ]
    .filter(Boolean)
    .join("; ");
}

/** Signs the user in by setting the session cookie on the response. */
export function setSession(res: Response, userId: number): void {
  const exp = Date.now() + SESSION_TTL_MS;
  const value = `${userId}.${exp}.${sign(`${userId}.${exp}`)}`;
  res.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${value}; ${cookieAttrs(Math.floor(SESSION_TTL_MS / 1000))}`,
  );
}

/** Signs the user out by expiring the session cookie. */
export function clearSession(res: Response): void {
  res.append("Set-Cookie", `${SESSION_COOKIE}=; ${cookieAttrs(0)}`);
}
