import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SECURITY_HEADERS } from "../server/security";
import { MemoryCounter, checkLimit, clientIp } from "../server/rate-limit";

test("vercel.json sends the same security headers as the server", () => {
  const cfg = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const all = cfg.headers.find((h: any) => h.source === "/(.*)");
  const sent = Object.fromEntries(all.headers.map((h: any) => [h.key, h.value]));
  assert.deepEqual(sent, SECURITY_HEADERS);
});

test("rate limit: allows up to the limit in a window, then blocks until it resets", async () => {
  const c = new MemoryCounter();
  let now = 1_000;
  for (let i = 1; i <= 5; i++) assert.equal((await checkLimit(c, "k", 5, 60_000, now)).allowed, true);
  const blocked = await checkLimit(c, "k", 5, 60_000, now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSec, 60);
  now += 61_000;
  assert.equal((await checkLimit(c, "k", 5, 60_000, now)).allowed, true);
});

test("client IP comes from the proxy's forwarded header", () => {
  assert.equal(clientIp({ headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" }, socket: { remoteAddress: "10.0.0.2" } } as any), "203.0.113.7");
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: "::1" } } as any), "::1");
});

import { sessionStillValid, hashResetToken } from "../server/auth-policy";

test("a session from before a password reset no longer works", () => {
  const reset = 10_000_000;
  assert.equal(sessionStillValid(reset - 60_000, { passwordChangedAt: reset }), false);
  assert.equal(sessionStillValid(reset + 5, { passwordChangedAt: reset }), true);
  assert.equal(sessionStillValid(123, { passwordChangedAt: null }), true);
});

test("reset tokens are stored as a SHA-256 hash, not as the token itself", () => {
  const t = "a".repeat(64);
  const h = hashResetToken(t);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.notEqual(h, t);
  assert.equal(hashResetToken(t), h);
});
