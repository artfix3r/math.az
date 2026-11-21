import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_ERROR_CODES } from "../server/errors";
import { translateError, hasTranslation, readSavedLang } from "../client/src/lib/i18n";

const LANGS = ["en", "az", "ru"] as const;

test("every error code has a translation in English, Azerbaijani and Russian", () => {
  const missing: string[] = [];
  for (const code of [...ALL_ERROR_CODES, "network"]) {
    for (const lang of LANGS) if (!hasTranslation(lang, `err.${code}`)) missing.push(`${lang}: err.${code}`);
  }
  assert.deepEqual(missing, []);
});

test("an error is shown in Azerbaijani when the site is in Azerbaijani", () => {
  const az = translateError({ code: "invalid_credentials", message: "Invalid credentials" }, "az");
  const en = translateError({ code: "invalid_credentials", message: "Invalid credentials" }, "en");
  assert.notEqual(az, en);
  assert.doesNotMatch(az, /Invalid credentials/);
});

test("error parameters are filled into the translated text", () => {
  const text = translateError({ code: "file_too_large", params: { max: "200" } }, "ru");
  assert.match(text, /200/);
});

test("a field name in an error is translated too", () => {
  const text = translateError({ code: "field_required", params: { field: "title" } }, "az");
  assert.doesNotMatch(text, /\btitle\b/);
});

test("an error without a known code shows the generic text in the chosen language", () => {
  assert.equal(
    translateError({ message: "Weird English text" }, "ru"),
    translateError({ code: "generic" }, "ru"),
  );
});

test("the language the person picked is restored after a refresh", () => {
  const store = { getItem: (k: string) => (k === "mathaz.lang" ? "ru" : null) };
  assert.equal(readSavedLang(store), "ru");
});

test("an unknown or missing saved language falls back to Azerbaijani", () => {
  assert.equal(readSavedLang({ getItem: () => "xx" }), "az");
  assert.equal(readSavedLang({ getItem: () => { throw new Error("blocked"); } }), "az");
});

test("dates are written in the site's language", async () => {
  const { formatDateTime } = await import("../client/src/lib/i18n");
  const ts = Date.UTC(2026, 10, 22, 14, 30);
  assert.match(formatDateTime(ts, "az"), /noyabr/i);
  assert.match(formatDateTime(ts, "ru"), /ноя/i);
  assert.match(formatDateTime(ts, "en"), /Nov/);
});

test("Azerbaijani dates don't depend on the browser having Azerbaijani data", async () => {
  const { formatDateTime } = await import("../client/src/lib/i18n");
  const real = Intl.DateTimeFormat;
  // Simulate a browser without "az" data: it falls back to English month names.
  (Intl as any).DateTimeFormat = function (loc: string, o: any) { return new real(String(loc).startsWith("az") ? "en-US" : loc, o); };
  try {
    const ts = new Date(2026, 10, 22, 14, 30).getTime();
    assert.equal(formatDateTime(ts, "az"), "22 noyabr, bazar 14:30");
  } finally {
    (Intl as any).DateTimeFormat = real;
  }
});
