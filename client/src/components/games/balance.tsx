import { useState } from "react";
import { equation, imbalance, type Equation } from "@shared/games";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import { Keypad } from "./keypad";

const LIVES = 3;

/**
 * Find x so both pans weigh the same. While you type, the beam tips toward the
 * heavier side for your guess, so you can see whether to go higher or lower.
 */
export function BalanceGame({ onFinish }: { onFinish: (score: number) => void }) {
  const { t } = useT();
  const [level, setLevel] = useState(0);
  const [eq, setEq] = useState<Equation>(() => equation(0));
  const [input, setInput] = useState("");
  const [lives, setLives] = useState(LIVES);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [over, setOver] = useState(false);

  const guess = input === "" || input === "-" ? null : Number(input);
  const diff = guess === null ? 0 : imbalance(eq, guess);
  const scale = Math.abs(eq.d) + Math.abs(eq.b) + 6;
  const angle = -16 * Math.tanh(diff / scale);

  const check = () => {
    if (over || guess === null) return;
    if (guess === eq.x) {
      const nextLevel = level + 1;
      setScore((s) => s + eq.points);
      setLevel(nextLevel);
      setFlash("ok");
      window.setTimeout(() => { setEq(equation(nextLevel)); setInput(""); setFlash(null); }, 650);
    } else {
      const l = lives - 1;
      setLives(l);
      setFlash("bad");
      window.setTimeout(() => setFlash(null), 320);
      if (l === 0) {
        setOver(true);
        window.setTimeout(() => onFinish(score), 700);
      }
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between text-sm">
        <span className="flex items-center gap-1" aria-label={t("play.lives", { n: lives })} data-testid="balance-lives">
          {Array.from({ length: LIVES }, (_, i) => (
            <Heart key={i} className={cn("h-4 w-4", i < lives ? "fill-pen text-pen" : "text-muted-foreground/40")} />
          ))}
        </span>
        <span className="text-muted-foreground">{t("play.level", { n: level + 1 })}</span>
        <span className="font-semibold tabular-nums" data-testid="balance-score">{t("play.score")}: {score}</span>
      </div>

      <div className={cn("w-full rounded-lg border bg-card px-2 pb-3 pt-4 shadow-sm transition-colors", flash === "ok" && "border-correct/60 bg-correct/5", flash === "bad" && "shake border-pen/60")}>
        <svg viewBox="0 0 320 170" className="w-full" role="img" aria-label={`${eq.left} = ${eq.right}`}>
          {/* stand */}
          <path d="M160 70 L140 160 L180 160 Z" className="fill-muted stroke-border" strokeWidth="1.5" />
          <rect x="110" y="158" width="100" height="6" rx="3" className="fill-border" />
          <g style={{ transform: `rotate(${flash === "ok" ? 0 : angle}deg)`, transformOrigin: "160px 70px", transition: "transform 420ms cubic-bezier(.34,1.3,.5,1)" }}>
            <rect x="30" y="66" width="260" height="8" rx="4" className="fill-primary" />
            <circle cx="160" cy="70" r="7" className="fill-card stroke-primary" strokeWidth="3" />
            {/* pans hang straight down from the beam ends */}
            {[{ x: 50, label: eq.left }, { x: 270, label: eq.right }].map((p, i) => (
              <g key={i} style={{ transform: `rotate(${-(flash === "ok" ? 0 : angle)}deg)`, transformOrigin: `${p.x}px 70px`, transition: "transform 420ms cubic-bezier(.34,1.3,.5,1)" }}>
                <line x1={p.x} y1="70" x2={p.x - 34} y2="112" className="stroke-muted-foreground" strokeWidth="1.5" />
                <line x1={p.x} y1="70" x2={p.x + 34} y2="112" className="stroke-muted-foreground" strokeWidth="1.5" />
                <path d={`M${p.x - 44} 112 h88 a44 14 0 0 1 -88 0 Z`} className="fill-secondary stroke-primary/50" strokeWidth="1.5" />
                {/* the expression is a weight block standing in the pan */}
                <rect x={p.x - 46} y="83" width="92" height="29" rx="5" className="fill-card stroke-primary/60" strokeWidth="1.5" />
                <text x={p.x} y="104" textAnchor="middle" className="fill-foreground" style={{ font: "600 17px Onest, sans-serif" }}>
                  {p.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
        <p className="mt-1 text-center text-sm text-muted-foreground" aria-live="polite">
          {flash === "ok" ? t("play.balance.balanced") : guess === null ? t("play.balance.how") : diff === 0 ? t("play.balance.balanced") : diff > 0 ? t("play.balance.leftHeavy") : t("play.balance.rightHeavy")}
        </p>
      </div>

      <p className="font-hand text-4xl leading-none text-primary" data-testid="balance-input">x = {input || "?"}</p>
      <Keypad value={input} onChange={setInput} onEnter={check} allowMinus disabled={over} enterLabel={t("play.check")} />
    </div>
  );
}
