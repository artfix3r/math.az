import { splitMath } from "./math";

// The visual question editor keeps text and formulas as separate parts and
// stores them in the usual "$latex$" form, so nothing else has to change.

export type Part = { kind: "text" | "math"; value: string };

export function toParts(value: string): Part[] {
  return splitMath(value)
    .filter((s) => s.value !== "" || s.kind !== "text")
    .map((s) => (s.kind === "text" ? { kind: "text", value: s.value } : { kind: "math", value: s.value }));
}

export function joinParts(parts: Part[]): string {
  return parts
    .map((p) => (p.kind === "math" ? `$${p.value}$` : p.value.replace(/\$/g, "\\$")))
    .join("");
}
