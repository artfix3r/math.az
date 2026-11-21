import { test } from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import { GROUPS } from "../client/src/lib/formula-keys";

test("every formula button produces maths that students' screens can show", () => {
  for (const g of GROUPS) {
    for (const k of g.keys) {
      const filled = k.latex.replace(/#[?@]/g, "x");
      assert.doesNotThrow(() => katex.renderToString(filled, { throwOnError: true, strict: "ignore" }), `${g.id} ${k.label}: ${filled}`);
    }
  }
});

test("button labels are unique within a group", () => {
  for (const g of GROUPS) {
    const labels = g.keys.map((k) => k.label);
    assert.equal(new Set(labels).size, labels.length, g.id);
  }
});
