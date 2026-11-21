// Reading the text out of a photo, PDF or Word file, in the browser.
// Heavy libraries load only when a teacher actually imports something.

export type Progress = { stage: "loading" | "reading" | "recognizing"; percent: number; page?: number; pages?: number };
export type Extracted = { text: string; image?: Blob; /** True when any of the text was read from a picture. */ ocr?: boolean };

const asset = (p: string) => new URL(p, document.baseURI).href;

export type DocLang = "aze" | "rus" | "eng";

let workerPromise: Promise<any> | null = null;
let workerLang: DocLang | null = null;
let progressSink: ((p: number) => void) | null = null;

// One language at a time: mixing Azerbaijani, Russian and English models makes
// the reader swap look-alike letters (x/х, e/ə) and drops accuracy sharply.
async function ocrWorker(lang: DocLang) {
  if (!workerPromise) {
    workerLang = lang;
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const w = await createWorker(lang, 1, {
        workerPath: asset("ocr/worker.min.js"),
        corePath: asset("ocr/core"),
        langPath: asset("ocr/lang"),
        gzip: true,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") progressSink?.(m.progress);
        },
      });
      await w.setParameters({ preserve_interword_spaces: "1", user_defined_dpi: "300" });
      return w;
    })().catch((e) => { workerPromise = null; throw e; });
  }
  const w = await workerPromise;
  if (workerLang !== lang) {
    await w.reinitialize(lang);
    await w.setParameters({ preserve_interword_spaces: "1", user_defined_dpi: "300" });
    workerLang = lang;
  }
  return w;
}

async function ocr(image: Blob | HTMLCanvasElement, lang: DocLang, onProgress: (p: number) => void): Promise<string> {
  const worker = await ocrWorker(lang);
  progressSink = onProgress;
  try {
    const { data } = await worker.recognize(image);
    return data.text as string;
  } finally {
    progressSink = null;
  }
}

/** Shrinks a photo for storing with a question (JPEG, longest side ≤ maxSide). */
export async function compressImage(file: Blob, maxSide = 1400, quality = 0.82): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL("image/jpeg", quality);
}

/**
 * Prepares a picture for recognition. Phone photos have shadows and uneven
 * light, which the reader handles badly; so we enlarge small text and turn
 * the page into clean black and white with a local (Sauvola) threshold.
 * On a shadowed Azerbaijani test photo this took errors from ~73% to ~2.5%.
 */
export function cleanForOcr(src: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement {
  const longest = Math.max(src.width, src.height);
  const scale = Math.min(2.5, Math.max(1, 2400 / longest));
  const w = Math.round(src.width * scale), h = Math.round(src.height * scale);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  binarize(img.data, w, h);
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Sauvola thresholding in place on RGBA pixels, using integral images. */
export function binarize(px: Uint8ClampedArray, w: number, h: number, k = 0.2) {
  const gray = new Float64Array(w * h);
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = 0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2];
  const W = w + 1;
  const sum = new Float64Array(W * (h + 1));
  const sq = new Float64Array(W * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rs = 0, rq = 0;
    for (let x = 1; x <= w; x++) {
      const g = gray[(y - 1) * w + (x - 1)];
      rs += g; rq += g * g;
      sum[y * W + x] = sum[(y - 1) * W + x] + rs;
      sq[y * W + x] = sq[(y - 1) * W + x] + rq;
    }
  }
  const r = Math.max(15, Math.round(Math.min(w, h) / 30));
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const n = (y1 - y0) * (x1 - x0);
      const s = sum[y1 * W + x1] - sum[y0 * W + x1] - sum[y1 * W + x0] + sum[y0 * W + x0];
      const q = sq[y1 * W + x1] - sq[y0 * W + x1] - sq[y1 * W + x0] + sq[y0 * W + x0];
      const m = s / n;
      const sd = Math.sqrt(Math.max(0, q / n - m * m));
      const v = gray[y * w + x] > m * (1 + k * (sd / 128 - 1)) ? 255 : 0;
      const j = (y * w + x) * 4;
      px[j] = px[j + 1] = px[j + 2] = v;
      px[j + 3] = 255;
    }
  }
}

async function prepareForOcr(file: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  try { return cleanForOcr(bmp); } finally { bmp.close(); }
}

async function readPdf(file: File, lang: DocLang, onProgress: (p: Progress) => void): Promise<{ text: string; ocr: boolean }> {
  let usedOcr = false;
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = Math.min(doc.numPages, 20);
  const out: string[] = [];
  for (let i = 1; i <= pages; i++) {
    onProgress({ stage: "reading", percent: (i - 1) / pages, page: i, pages });
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    let lastY: number | null = null;
    for (const item of content.items as any[]) {
      if (!("str" in item)) continue;
      const y = item.transform?.[5];
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 3) text += "\n";
      else if (text && !text.endsWith(" ") && item.str && !item.str.startsWith(" ")) text += " ";
      text += item.str;
      if (item.hasEOL) text += "\n";
      lastY = y ?? lastY;
    }
    if (text.replace(/\s/g, "").length < 25) {
      // A scanned page: no text layer, so read the picture.
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas } as any).promise;
      usedOcr = true;
      text = await ocr(cleanForOcr(canvas), lang, (p) => onProgress({ stage: "recognizing", percent: (i - 1 + p) / pages, page: i, pages }));
    }
    out.push(text);
  }
  return { text: out.join("\n"), ocr: usedOcr };
}

export async function extractText(file: File, lang: DocLang, onProgress: (p: Progress) => void): Promise<Extracted> {
  const name = file.name.toLowerCase();
  onProgress({ stage: "loading", percent: 0 });
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|bmp|gif)$/.test(name)) {
    const canvas = await prepareForOcr(file);
    const text = await ocr(canvas, lang, (p) => onProgress({ stage: "recognizing", percent: p }));
    return { text, image: file, ocr: true };
  }
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return await readPdf(file, lang, onProgress);
  }
  if (name.endsWith(".docx")) {
    onProgress({ stage: "reading", percent: 0.3 });
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { text: value };
  }
  if (file.type.startsWith("text/") || /\.(txt|md|csv)$/.test(name)) {
    return { text: await file.text() };
  }
  throw new Error("unsupported_file");
}
