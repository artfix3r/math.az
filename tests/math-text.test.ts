import { test } from "node:test";
import assert from "node:assert/strict";
import { splitMath, renderMathHtml } from "../client/src/lib/math";

test("text without dollar signs is a single text segment", () => {
  assert.deepEqual(splitMath("What is 2 + 2?"), [{ kind: "text", value: "What is 2 + 2?" }]);
});

test("$...$ becomes an inline formula and $$...$$ a display formula", () => {
  assert.deepEqual(splitMath("Solve $x^2=4$ then $$\\frac{1}{2}$$ done"), [
    { kind: "text", value: "Solve " },
    { kind: "inline", value: "x^2=4" },
    { kind: "text", value: " then " },
    { kind: "display", value: "\\frac{1}{2}" },
    { kind: "text", value: " done" },
  ]);
});

test("an escaped \\$ stays a literal dollar sign (for prices)", () => {
  assert.deepEqual(splitMath("It costs \\$5 and \\$7"), [{ kind: "text", value: "It costs $5 and $7" }]);
});

test("an unclosed $ is left as plain text", () => {
  assert.deepEqual(splitMath("price is $5"), [{ kind: "text", value: "price is $5" }]);
});

test("formulas are rendered with KaTeX", () => {
  const html = renderMathHtml("Find $\\sqrt{16}$");
  assert.match(html, /class="katex/);
  assert.match(html, /^Find /);
});

test("plain text is escaped, so HTML in a question can't run", () => {
  const html = renderMathHtml('<img src=x onerror="alert(1)"> and $x$');
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test("a broken formula is shown as its source text instead of crashing", () => {
  const html = renderMathHtml("Bad $\\frac{1}$ formula");
  assert.match(html, /Bad /);
  assert.match(html, /formula$/);
});

test("line breaks in plain text are kept", () => {
  assert.match(renderMathHtml("line one\nline two"), /line one<br>line two/);
});
