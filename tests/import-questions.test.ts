import { test } from "node:test";
import assert from "node:assert/strict";
import { splitQuestions, mathify } from "../shared/import-questions";

test("numbered questions with options on their own lines", () => {
  const text = `1. Hesablayın: 2 + 3
A) 4
B) 5
C) 6
2) Tənliyi həll edin: x + 1 = 3
3. Üçbucağın bucaqları cəmi neçə dərəcədir?`;
  const qs = splitQuestions(text);
  assert.equal(qs.length, 3);
  assert.equal(qs[0].prompt, "Hesablayın: 2 + 3");
  assert.deepEqual(qs[0].options, ["4", "5", "6"]);
  assert.equal(qs[0].type, "mcq");
  assert.equal(qs[1].type, "open");
  assert.equal(qs[1].prompt, "Tənliyi həll edin: x + 1 = 3");
});

test("options written on one line are split", () => {
  const qs = splitQuestions("1. 7 · 8 = ?\nA) 54  B) 56  C) 64  D) 48");
  assert.deepEqual(qs[0].options, ["54", "56", "64", "48"]);
});

test("Russian headings and Cyrillic option letters", () => {
  const qs = splitQuestions("Задание 1. Найдите корень уравнения\n2x = 10\nА) 2\nБ) 5\nВ) 10\nЗадание 2. Сколько будет 3²?");
  assert.equal(qs.length, 2);
  assert.equal(qs[0].prompt, "Найдите корень уравнения 2x = 10");
  assert.deepEqual(qs[0].options, ["2", "5", "10"]);
});

test("OCR line breaks inside a question are joined", () => {
  const qs = splitQuestions("1. Bir ədədin üçdə biri\n12-yə bərabərdir. Bu ədədi tapın.");
  assert.equal(qs[0].prompt, "Bir ədədin üçdə biri 12-yə bərabərdir. Bu ədədi tapın.");
});

test("text with no numbering becomes one question", () => {
  const qs = splitQuestions("  Sadələşdirin: (a + b)² − 2ab  \n");
  assert.equal(qs.length, 1);
  assert.equal(qs[0].type, "open");
});

test("empty text gives no questions", () => {
  assert.deepEqual(splitQuestions(" \n \n"), []);
});

test("mathify turns plain maths into formulas", () => {
  assert.equal(mathify("x^2 + √16 = 3/4"), "$x^{2}$ + $\\sqrt{16}$ = $\\frac{3}{4}$");
  assert.equal(mathify("Sadələşdirin: a² − b³"), "Sadələşdirin: $a^{2}$ − $b^{3}$");
});

test("mathify leaves dates and text alone", () => {
  assert.equal(mathify("Tarix: 12/05/2024"), "Tarix: 12/05/2024");
  assert.equal(mathify("Bu sual asandır."), "Bu sual asandır.");
});

test("a lone dollar sign in imported text is escaped", () => {
  assert.equal(mathify("Qiyməti 5$-dır"), "Qiyməti 5\\$-dır");
});

test("Cyrillic look-alike letters read by OCR in a Latin-script line become Latin", () => {
  assert.equal(mathify("Tənliyi həll edin: х^2 = 16"), "Tənliyi həll edin: $x^{2}$ = 16");
});

test("Russian text keeps its Cyrillic letters", () => {
  assert.equal(mathify("Решите: 2х = 10"), "Решите: 2х = 10");
});

test("maths italic letters from PDFs become normal letters", () => {
  assert.equal(mathify("𝑥 + 1 = 3"), "x + 1 = 3");
});

test("Cyrillic schwa becomes the Azerbaijani ə", () => {
  assert.equal(mathify("Әdədi tapın: hәll edin"), "Ədədi tapın: həll edin");
});

import { repairOcr } from "../shared/import-questions";

test("OCR repair: a question number read as $ or S becomes 5", () => {
  assert.equal(repairOcr("$. Ədədin yarısı"), "5. Ədədin yarısı");
  assert.equal(repairOcr("S, Ədədin yarısı"), "5. Ədədin yarısı");
});

test("OCR repair: percent read as 96 before a suffix", () => {
  assert.equal(repairOcr("Ədədin 2596-i 60-a bərabərdir"), "Ədədin 25%-i 60-a bərabərdir");
});

test("OCR repair: degree read as 9 in an angle question", () => {
  assert.equal(repairOcr("Bucaqlardan biri 489, digəri"), "Bucaqlardan biri 48°, digəri");
  assert.equal(repairOcr("Kitab 489 səhifədir"), "Kitab 489 səhifədir");
});

test("OCR repair: squared units", () => {
  assert.equal(repairOcr("A) 40 sm, 96 sm? B) 32 sm, 64 sm: C) 1 m”"), "A) 40 sm, 96 sm² B) 32 sm, 64 sm² C) 1 m²");
});

test("OCR repair: drops lines of stray marks", () => {
  assert.equal(repairOcr("1. Sual\n:——\n—\nA) 2"), "1. Sual\nA) 2");
});

test("units with squares stay as they are", () => {
  assert.equal(mathify("96 sm² və 3 m³"), "96 sm² və 3 m³");
  assert.equal(mathify("a² + b²"), "$a^{2}$ + $b^{2}$");
});
