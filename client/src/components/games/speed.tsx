import { useEffect, useRef, useState } from "react";
import { speedProblem, type SpeedProblem } from "@shared/games";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Keypad } from "./keypad";

const ROUND_MS = 60_000;

/**
 * Sixty seconds of mental maths. An answer is checked as soon as it has as
 * many digits as the right one, so there is no "submit" to press. Every third
 * right answer in a row makes the sums harder and worth more.
 */
export function SpeedGame({ onFinish }: { onFinish: (score: number) => void }) {
  const { t } = useT();
  const [started, setStarted] = useState(false);
  const [left, setLeft] = useState(ROUND_MS);
  const [problem, setProblem] = useState<SpeedProblem>(() => speedProblem(0));
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState(0);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const done = useRef(false);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  useEffect(() => {
    if (!started) return;
    const endAt = Date.now() + ROUND_MS;
    const id = window.setInterval(() => {
      const ms = Math.max(0, endAt - Date.now());
      setLeft(ms);
      if (ms === 0 && !done.current) {
        done.current = true;
        window.clearInterval(id);
        onFinish(scoreRef.current);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [started, onFinish]);

  const type = (v: string) => {
    if (!started || done.current) return;
    setInput(v);
    const want = String(problem.answer);
    if (v.length < want.length) return;
    const right = Number(v) === problem.answer;
    const nextStreak = right ? streak + 1 : 0;
    if (right) {
      setScore((s) => s + problem.points);
      setSolved((n) => n + 1);
    }
    setStreak(nextStreak);
    setFlash(right ? "ok" : "bad");
    window.setTimeout(() => setFlash(null), 260);
    setInput("");
    setProblem(speedProblem(Math.floor((solved + (right ? 1 : 0)) / 3)));
  };

  const seconds = Math.ceil(left / 1000);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5">
      <div className="flex w-full items-center justify-between text-sm">
        <span className="tabular-nums text-muted-foreground" data-testid="speed-time">
          {t("play.timeLeft", { s: seconds })}
        </span>
        <span className="font-semibold tabular-nums" data-testid="speed-score">{t("play.score")}: {score}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={cn("h-full bg-primary transition-[width] duration-100 ease-linear", seconds <= 10 && "bg-pen")} style={{ width: `${(left / ROUND_MS) * 100}%` }} />
      </div>

      {!started ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="max-w-xs text-muted-foreground">{t("play.speed.how")}</p>
          <Button size="lg" className="font-semibold" onClick={() => setStarted(true)} data-testid="button-start-game">{t("play.start")}</Button>
        </div>
      ) : (
        <>
          <div
            className={cn(
              "flex w-full flex-col items-center rounded-lg border bg-card px-4 py-6 shadow-sm transition-colors",
              flash === "ok" && "border-correct/60 bg-correct/5",
              flash === "bad" && "shake border-pen/60 bg-pen/5",
            )}
          >
            <p className="text-4xl font-semibold tabular-nums sm:text-5xl" data-testid="speed-problem" aria-live="polite">
              {problem.text} =
            </p>
            <p className="mt-3 h-12 min-w-24 border-b-2 border-primary/40 text-center font-hand text-5xl leading-none text-primary" data-testid="speed-input">
              {input || " "}
            </p>
            <p className="mt-3 h-5 text-sm text-muted-foreground">
              {streak >= 3 && t("play.streak", { n: streak })}
            </p>
          </div>
          <Keypad value={input} onChange={type} />
        </>
      )}
    </div>
  );
}
