import { useEffect, useRef, useState } from "react";
import { memoryDeck, memoryScore, type Card } from "@shared/games";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PAIRS = 8;

/** Turn two cards; if they are the same value written two ways, they stay up. */
export function MemoryGame({ onFinish }: { onFinish: (score: number) => void }) {
  const { t } = useT();
  const [deck] = useState<Card[]>(() => memoryDeck(PAIRS));
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const busy = useRef(false);

  useEffect(() => {
    if (startedAt === null || matched.size === PAIRS) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [startedAt, matched.size]);

  const seconds = startedAt === null ? 0 : Math.floor((now - startedAt) / 1000);

  const flip = (c: Card) => {
    if (busy.current || open.includes(c.id) || matched.has(c.pair)) return;
    if (startedAt === null) { setStartedAt(Date.now()); setNow(Date.now()); }
    const next = [...open, c.id];
    setOpen(next);
    if (next.length < 2) return;
    const [a, b] = next.map((id) => deck[id]);
    const m = moves + 1;
    setMoves(m);
    busy.current = true;
    if (a.pair === b.pair) {
      const done = new Set(matched).add(a.pair);
      window.setTimeout(() => {
        setMatched(done);
        setOpen([]);
        busy.current = false;
        if (done.size === PAIRS) {
          const secs = Math.floor((Date.now() - (startedAt ?? Date.now())) / 1000);
          window.setTimeout(() => onFinish(memoryScore(PAIRS, m, secs)), 500);
        }
      }, 350);
    } else {
      window.setTimeout(() => { setOpen([]); busy.current = false; }, 900);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("play.memory.hint")}</span>
        <span className="flex gap-3 tabular-nums">
          <span data-testid="memory-moves">{t("play.moves", { n: moves })}</span>
          <span className="text-muted-foreground">{seconds}s</span>
        </span>
      </div>
      <div className="grid w-full grid-cols-4 gap-2" style={{ perspective: "800px" }} data-testid="memory-board">
        {deck.map((c) => {
          const up = open.includes(c.id) || matched.has(c.pair);
          const done = matched.has(c.pair);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => flip(c)}
              disabled={done}
              aria-label={up ? c.label : t("play.memory.hidden")}
              data-testid={`memory-card-${c.id}`}
              className="relative aspect-[4/5] rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={cn("card-flip absolute inset-0", up && "is-up")}>
                <span className="card-face paper-grid absolute inset-0 flex items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
                  <span className="font-hand text-3xl opacity-80">π</span>
                </span>
                <span className={cn(
                  "card-face card-back absolute inset-0 flex items-center justify-center rounded-md border bg-card px-1 text-center text-lg font-semibold shadow-sm sm:text-xl",
                  done && "border-correct/60 bg-correct/10 text-correct",
                )}>
                  {c.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
