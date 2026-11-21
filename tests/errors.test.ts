import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { z } from "zod";
import { codeForMessage, zodErrorBody, ERROR_CODES } from "../server/errors";
import { passwordSchema } from "../shared/schema";

test("a known server message gets its error code", () => {
  assert.deepEqual(codeForMessage("Invalid credentials"), { code: "invalid_credentials" });
});

test("'<Thing> not found' messages get the not_found code", () => {
  assert.equal(codeForMessage("Quiz not found").code, "not_found");
});

test("the upload size limit message carries the limit as a parameter", () => {
  assert.deepEqual(codeForMessage("Files can be at most 200 MB"), {
    code: "file_too_large",
    params: { max: "200" },
  });
});

test("an unknown message falls back to the generic code", () => {
  assert.equal(codeForMessage("Something nobody planned for").code, "generic");
});

test("a too-short password becomes password_too_short", () => {
  const r = z.object({ password: passwordSchema }).safeParse({ password: "a!" });
  assert.ok(!r.success);
  assert.equal(zodErrorBody(r.error).code, "password_too_short");
});

test("an invalid email becomes invalid_email", () => {
  const r = z.object({ email: z.string().email() }).safeParse({ email: "nope" });
  assert.ok(!r.success);
  assert.equal(zodErrorBody(r.error).code, "invalid_email");
});

test("an empty required field becomes field_required and names the field", () => {
  const r = z.object({ title: z.string().min(1) }).safeParse({ title: "" });
  assert.ok(!r.success);
  assert.deepEqual(zodErrorBody(r.error), {
    message: r.error.errors[0].message,
    code: "field_required",
    params: { field: "title" },
  });
});

test("every literal error message in the server code has an error code", () => {
  const dir = new URL("../server/", import.meta.url);
  const missing: string[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
    const src = readFileSync(new URL(f, dir), "utf8");
    for (const m of src.matchAll(/message: "([^"]+)"/g)) {
      if (codeForMessage(m[1]).code === "generic" && ERROR_CODES[m[1]] !== "generic") missing.push(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});
