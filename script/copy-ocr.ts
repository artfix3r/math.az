import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

// Photo/scan text recognition (Tesseract) runs in the teacher's browser.
// Its engine and the Azerbaijani, Russian and English language data are
// served from our own site so nothing depends on an outside CDN.
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "client", "public", "ocr");
const nm = (p: string) => path.join(root, "node_modules", p);

export async function copyOcrAssets() {
  await mkdir(path.join(out, "lang"), { recursive: true });
  await mkdir(path.join(out, "core"), { recursive: true });
  await copyFile(nm("tesseract.js/dist/worker.min.js"), path.join(out, "worker.min.js"));
  for (const f of ["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"]) {
    await copyFile(nm(`tesseract.js-core/${f}`), path.join(out, "core", f));
  }
  for (const l of ["aze", "rus", "eng"]) {
    await copyFile(nm(`@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`), path.join(out, "lang", `${l}.traineddata.gz`));
  }
}

if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  await copyOcrAssets();
  console.log("OCR assets copied to client/public/ocr");
}
