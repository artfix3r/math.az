// Reading the text out of a photo, PDF or Word file, in the browser.
// Heavy libraries load only when a teacher actually imports something.

export type Progress = { stage: "loading" | "reading" | "recognizing"; percent: number; page?: number; pages?: number };
export type Extracted = { text: string; image?: Blob };

const asset = (p: string) => new URL(p, document.baseURI).href;

let workerPromise: Promise<any> | null = null;
let progressSink: ((p: number) => void) | null = null;

async function ocrWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return createWorker(["aze", "rus", "eng"], 1, {
        workerPath: asset("ocr/worker.min.js"),
        corePath: asset("ocr/core"),
        langPath: asset("ocr/lang"),
        gzip: true,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") progressSink?.(m.progress);
        },
      });
    })().catch((e) => { workerPromise = null; throw e; });
  }
  return workerPromise;
}

async function ocr(image: Blob | HTMLCanvasElement, onProgress: (p: number) => void): Promise<string> {
  const worker = await ocrWorker();
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

/** Prepares a photo for recognition: upright, not too big, greyscale. */
async function prepareForOcr(file: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.filter = "grayscale(1) contrast(1.15)";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

async function readPdf(file: File, onProgress: (p: Progress) => void): Promise<string> {
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
      text = await ocr(canvas, (p) => onProgress({ stage: "recognizing", percent: (i - 1 + p) / pages, page: i, pages }));
    }
    out.push(text);
  }
  return out.join("\n");
}

export async function extractText(file: File, onProgress: (p: Progress) => void): Promise<Extracted> {
  const name = file.name.toLowerCase();
  onProgress({ stage: "loading", percent: 0 });
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|bmp|gif)$/.test(name)) {
    const canvas = await prepareForOcr(file);
    const text = await ocr(canvas, (p) => onProgress({ stage: "recognizing", percent: p }));
    return { text, image: file };
  }
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return { text: await readPdf(file, onProgress) };
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
