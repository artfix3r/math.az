import { useCallback, useEffect, useRef, useState } from "react";
import { Undo2, Eraser, Trash2, PenLine } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Write or draw by hand with a finger, stylus or mouse.
 * Students use it for open answers (ink on squared paper); teachers use it to
 * mark an answer in red pen over the student's work. The result is a
 * transparent PNG (data URL) so it can be laid over what is underneath.
 */

type Point = { x: number; y: number; p: number };
type Stroke = { color: string; width: number; erase: boolean; points: Point[] };

// Logical drawing size; the canvas scales to the width it is given.
const W = 1000;
const H = 620;

export function HandwritingPad({
  value,
  onChange,
  colors,
  background,
  paper = true,
  testId,
  label,
}: {
  value: string;
  onChange: (png: string) => void;
  /** Pen colours to choose from; the first is the default. */
  colors: { value: string; label: string }[];
  /** An image drawn underneath (e.g. the student's answer when a teacher marks it). Not exported. */
  background?: string;
  paper?: boolean;
  testId?: string;
  label: string;
}) {
  const { t } = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const base = useRef<HTMLImageElement | null>(null);
  const current = useRef<Stroke | null>(null);
  const lastValue = useRef<string>("");
  const [color, setColor] = useState(colors[0].value);
  const [thick, setThick] = useState(false);
  const [erase, setErase] = useState(false);
  const [, force] = useState(0);

  const ctx = () => canvas.current!.getContext("2d")!;

  const drawStroke = (c: CanvasRenderingContext2D, s: Stroke) => {
    c.save();
    c.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    c.strokeStyle = s.color;
    c.fillStyle = s.color;
    c.lineCap = "round";
    c.lineJoin = "round";
    const pts = s.points;
    if (pts.length === 1) {
      c.beginPath();
      c.arc(pts[0].x, pts[0].y, (s.width * (0.5 + pts[0].p)) / 2, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      c.lineWidth = s.width * (0.55 + (a.p + b.p) / 2);
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
    c.restore();
  };

  const redraw = useCallback(() => {
    const c = ctx();
    c.clearRect(0, 0, W, H);
    if (base.current) c.drawImage(base.current, 0, 0, W, H);
    for (const s of strokes.current) drawStroke(c, s);
  }, []);

  // Load an existing drawing (e.g. reopening the grading dialog) as the base layer.
  useEffect(() => {
    if (value === lastValue.current) return;
    lastValue.current = value;
    strokes.current = [];
    if (!value) { base.current = null; redraw(); return; }
    const img = new Image();
    img.onload = () => { base.current = img; redraw(); };
    img.src = value;
  }, [value, redraw]);

  const emit = () => {
    const empty = !base.current && strokes.current.every((s) => s.erase);
    const png = empty ? "" : canvas.current!.toDataURL("image/png");
    lastValue.current = png;
    onChange(png);
    force((n) => n + 1);
  };

  const pos = (e: React.PointerEvent): Point => {
    const r = canvas.current!.getBoundingClientRect();
    const pressure = e.pointerType === "pen" ? Math.max(0.1, e.pressure || 0.5) : 0.5;
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, p: pressure };
  };

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    current.current = { color, width: erase ? 28 : thick ? 7 : 3.6, erase, points: [pos(e)] };
    drawStroke(ctx(), current.current);
  };
  const move = (e: React.PointerEvent) => {
    const s = current.current;
    if (!s) return;
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events) {
      const p = pos({ ...e, clientX: ev.clientX, clientY: ev.clientY, pressure: ev.pressure } as any);
      const last = s.points[s.points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 0.8) continue;
      s.points.push(p);
      drawStroke(ctx(), { ...s, points: [last, p] });
    }
  };
  const up = () => {
    if (!current.current) return;
    strokes.current.push(current.current);
    current.current = null;
    emit();
  };

  const undo = () => {
    if (strokes.current.length) strokes.current.pop();
    else base.current = null;
    redraw();
    emit();
  };
  const clear = () => { strokes.current = []; base.current = null; redraw(); emit(); };
  const canUndo = strokes.current.length > 0 || !!base.current;

  const tool = "inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-md border bg-card px-2.5 text-sm font-medium transition-colors disabled:opacity-40";

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={label}>
        {colors.map((c) => (
          <button key={c.value} type="button" title={c.label} aria-label={c.label} aria-pressed={!erase && color === c.value}
            onClick={() => { setColor(c.value); setErase(false); }}
            className={cn(tool, "px-2", !erase && color === c.value && "border-primary ring-1 ring-primary")}>
            <span className="h-5 w-5 rounded-full border border-black/10" style={{ background: c.value }} />
          </button>
        ))}
        <button type="button" aria-pressed={!erase && thick} onClick={() => { setThick((v) => !v); setErase(false); }} className={cn(tool, !erase && thick && "border-primary ring-1 ring-primary")}>
          <PenLine className="h-4 w-4" /> {thick ? t("pad.thick") : t("pad.thin")}
        </button>
        <button type="button" aria-pressed={erase} onClick={() => setErase((v) => !v)} className={cn(tool, erase && "border-primary ring-1 ring-primary")} data-testid={testId ? `${testId}-eraser` : undefined}>
          <Eraser className="h-4 w-4" /> {t("pad.eraser")}
        </button>
        <span className="flex-1" />
        <button type="button" onClick={undo} disabled={!canUndo} className={tool} aria-label={t("pad.undo")} title={t("pad.undo")}><Undo2 className="h-4 w-4" /></button>
        <button type="button" onClick={clear} disabled={!canUndo} className={tool} aria-label={t("pad.clear")} title={t("pad.clear")}><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className={cn("relative overflow-hidden rounded-md border border-input", paper ? "paper-grid" : "bg-card")} style={{ aspectRatio: `${W} / ${H}` }}>
        {background && <img src={background} alt="" className="pointer-events-none absolute inset-0 h-full w-full select-none" draggable={false} />}
        <canvas
          ref={canvas}
          width={W}
          height={H}
          aria-label={label}
          role="img"
          data-testid={testId ? `${testId}-canvas` : undefined}
          className={cn("absolute inset-0 h-full w-full touch-none", erase ? "cursor-cell" : "cursor-crosshair")}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={(e) => { if (current.current && e.buttons === 0) up(); }}
        />
      </div>
    </div>
  );
}

/** A finished drawing (and optional red-pen layer on top) shown on paper. */
export function DrawingView({ drawing, annotation, className, alt }: { drawing?: string; annotation?: string; className?: string; alt: string }) {
  if (!drawing && !annotation) return null;
  return (
    <div className={cn("paper-grid relative overflow-hidden rounded-md border border-input", className)} style={{ aspectRatio: `${W} / ${H}` }} role="img" aria-label={alt}>
      {drawing && <img src={drawing} alt="" className="absolute inset-0 h-full w-full" />}
      {annotation && <img src={annotation} alt="" className="absolute inset-0 h-full w-full" />}
    </div>
  );
}

export const STUDENT_INKS = (t: (k: string) => string) => [
  { value: "#1F3A93", label: t("pad.blue") },
  { value: "#1C2433", label: t("pad.black") },
];
export const TEACHER_INKS = (t: (k: string) => string) => [
  { value: "#D92D2D", label: t("pad.red") },
  { value: "#1E8A53", label: t("pad.green") },
];
