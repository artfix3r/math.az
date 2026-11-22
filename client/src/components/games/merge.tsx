import { useEffect, useRef, useState } from "react";
import { addTile, canMove, emptyBoard, slide, type Board, type Dir } from "@shared/games";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";

// Tile colours climb from paper to ink as numbers grow, using the site's own blues.
function tileClass(v: number) {
  if (v === 0) return "bg-muted/60";
  if (v <= 4) return "bg-card text-foreground border";
  if (v <= 16) return "bg-primary/15 text-primary";
  if (v <= 64) return "bg-primary/35 text-primary";
  if (v <= 256) return "bg-primary/70 text-primary-foreground";
  if (v <= 1024) return "bg-primary text-primary-foreground";
  return "bg-pen text-white";
}

/** Slide the tiles; equal numbers merge and their sum is added to the score. */
export function MergeGame({ onFinish }: { onFinish: (score: number) => void }) {
  const { t } = useT();
  const [board, setBoard] = useState<Board>(() => addTile(addTile(emptyBoard())));
  const [score, setScore] = useState(0);
  const [fresh, setFresh] = useState<string>("");
  const over = useRef(false);
  const state = useRef({ board, score });
  state.current = { board, score };

  const move = (dir: Dir) => {
    if (over.current) return;
    const { board: b, score: s } = state.current;
    const r = slide(b, dir);
    if (!r.moved) return;
    const next = addTile(r.board);
    // Remember which cell the new tile landed in, for its small pop-in.
    let key = "";
    next.forEach((row, i) => row.forEach((v, j) => { if (v && !r.board[i][j]) key = `${i}-${j}`; }));
    setFresh(key + ":" + Date.now());
    setBoard(next);
    setScore(s + r.gained);
    if (!canMove(next)) {
      over.current = true;
      window.setTimeout(() => onFinish(s + r.gained), 600);
    }
  };

  useEffect(() => {
    const keys: Record<string, Dir> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" };
    const onKey = (e: KeyboardEvent) => {
      const dir = keys[e.key];
      if (!dir) return;
      e.preventDefault();
      move(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Swipes on touch screens and mouse drags.
  const start = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { start.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  const freshKey = fresh.split(":")[0];
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between gap-3 text-sm">
        <span className="min-w-0 text-muted-foreground">{t("play.merge.hint")}</span>
        <span className="shrink-0 font-semibold tabular-nums" data-testid="merge-score">{t("play.score")}: {score}</span>
      </div>
      <div
        className="grid w-full touch-none select-none grid-cols-4 gap-2 rounded-lg border bg-secondary/50 p-2 shadow-sm"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { start.current = null; }}
        role="grid"
        aria-label={t("play.merge.name")}
        data-testid="merge-board"
      >
        {board.flatMap((row, i) =>
          row.map((v, j) => (
            <div
              key={`${i}-${j}-${v}-${freshKey === `${i}-${j}` ? fresh : ""}`}
              role="gridcell"
              className={cn(
                "flex aspect-square items-center justify-center rounded-md font-semibold tabular-nums transition-colors",
                v >= 1024 ? "text-xl sm:text-2xl" : v >= 128 ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl",
                tileClass(v),
                v !== 0 && "tile-pop",
              )}
            >
              {v || ""}
            </div>
          )),
        )}
      </div>
      <div className="grid grid-cols-4 gap-2" aria-label={t("play.merge.buttons")}>
        {([["left", ArrowLeft], ["up", ArrowUp], ["down", ArrowDown], ["right", ArrowRight]] as const).map(([d, Icon]) => (
          <Button key={d} variant="outline" size="icon" className="h-12 w-12" onClick={() => move(d)} aria-label={t(`play.dir.${d}`)} data-testid={`merge-${d}`}>
            <Icon className="h-5 w-5" />
          </Button>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { if (!over.current) { over.current = true; onFinish(score); } }} data-testid="button-end-game">
        {t("play.endGame")}
      </Button>
    </div>
  );
}
