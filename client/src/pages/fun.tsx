import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Logo } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { AppShell, LanguageSwitcher, ThemeToggle } from "@/pages/shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Crown, RotateCcw, LogIn } from "lucide-react";
import { GAMES, type GameId, isGame } from "@shared/games";
import { SpeedGame } from "@/components/games/speed";
import { MergeGame } from "@/components/games/merge";
import { BalanceGame } from "@/components/games/balance";
import { MemoryGame } from "@/components/games/memory";

// ---------- personal best, kept in the browser (works for guests too) ----------
const bestKey = (g: GameId) => `mathaz-best-${g}`;
function readBest(g: GameId): number {
  try { return Number(window.localStorage.getItem(bestKey(g))) || 0; } catch { return 0; }
}
function writeBest(g: GameId, score: number) {
  try { window.localStorage.setItem(bestKey(g), String(score)); } catch { /* storage blocked */ }
}

type Board = { weekStart: number; top: { rank: number; name: string; score: number; me: boolean }[]; myBest: number | null };

/** Signed-in players see the page inside the app; guests get a light header. */
function Frame({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useT();
  if (loading) return null;
  if (user) return <AppShell>{children}</AppShell>;
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b bg-background/90 px-3 backdrop-blur-sm sm:px-6 lg:h-16">
        <Link href="/" aria-label="math.az"><Logo className="text-[16px]" /></Link>
        <div className="flex-1" />
        <LanguageSwitcher />
        <ThemeToggle />
        <Button asChild size="sm" className="ml-1 gap-1.5 font-semibold">
          <Link href="/" data-testid="link-guest-signin"><LogIn className="h-4 w-4" />{t("play.signIn")}</Link>
        </Button>
      </header>
      <main className="page-in mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
    </div>
  );
}

// ---------- small drawings of each game for the hub ----------
function Preview({ game }: { game: GameId }) {
  if (game === "speed") {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-2xl font-semibold tabular-nums">
        7 × 8 = <span className="font-hand text-4xl text-pen">56</span>
      </div>
    );
  }
  if (game === "merge") {
    const cells = [2, 0, 4, 0, 0, 8, 8, 2, 16, 0, 2, 0, 64, 32, 4, 2];
    return (
      <div className="mx-auto grid h-full max-h-28 grid-cols-4 gap-1 p-1" style={{ aspectRatio: "1" }} aria-hidden="true">
        {cells.map((v, i) => (
          <span key={i} className={cn("flex items-center justify-center rounded-sm text-[11px] font-semibold",
            v === 0 ? "bg-muted/70" : v <= 4 ? "border bg-card" : v <= 16 ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground")}>
            {v || ""}
          </span>
        ))}
      </div>
    );
  }
  if (game === "balance") {
    return (
      <svg viewBox="0 0 200 100" className="mx-auto h-full max-h-28" aria-hidden="true">
        <path d="M100 38 L88 92 L112 92 Z" className="fill-muted stroke-border" />
        <g transform="rotate(-7 100 38)">
          <rect x="20" y="35" width="160" height="6" rx="3" className="fill-primary" />
          <g transform="rotate(7 34 38)">
            <path d="M8 68 h52 a26 9 0 0 1 -52 0 Z" className="fill-secondary stroke-primary/50" />
            <text x="34" y="62" textAnchor="middle" className="fill-foreground" style={{ font: "600 14px Onest, sans-serif" }}>2x + 3</text>
          </g>
          <g transform="rotate(7 166 38)">
            <path d="M140 68 h52 a26 9 0 0 1 -52 0 Z" className="fill-secondary stroke-primary/50" />
            <text x="166" y="62" textAnchor="middle" className="fill-foreground" style={{ font: "600 14px Onest, sans-serif" }}>11</text>
          </g>
        </g>
      </svg>
    );
  }
  return (
    <div className="flex h-full items-center justify-center gap-2" aria-hidden="true">
      {["½", "", "0.5"].map((l, i) => (
        <span key={i} className={cn("flex h-16 w-12 items-center justify-center rounded-md border text-lg font-semibold shadow-sm",
          l ? "bg-card" : "paper-grid bg-primary text-primary-foreground")}>
          {l || <span className="font-hand text-2xl opacity-80">π</span>}
        </span>
      ))}
    </div>
  );
}

function Leaderboard({ game, compact = false }: { game: GameId; compact?: boolean }) {
  const { t } = useT();
  const { user } = useAuth();
  const { data, isLoading } = useQuery<Board>({ queryKey: [`/api/games/leaderboard?game=${game}`] });
  return (
    <section aria-labelledby={`lb-${game}`} className="rounded-lg border bg-card p-4 shadow-sm">
      <h2 id={`lb-${game}`} className="flex items-center gap-2 font-semibold">
        <Crown className="h-4 w-4 text-due" /> {compact ? t("play.leadersWeek") : t(`play.${game}.name`)}
      </h2>
      {isLoading ? (
        <div className="mt-3 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-6" />)}</div>
      ) : data && data.top.length ? (
        <ol className="mt-3 space-y-1" data-testid={`leaderboard-${game}`}>
          {data.top.map((r) => (
            <li key={r.rank} className={cn("flex items-center gap-3 rounded-md px-2 py-1.5 text-sm", r.me && "bg-secondary font-semibold")}>
              <span className={cn("w-5 text-right tabular-nums text-muted-foreground", r.rank === 1 && "font-hand text-lg text-pen")}>{r.rank}</span>
              <span className="min-w-0 flex-1 truncate">{r.name}{r.me && ` (${t("play.you")})`}</span>
              <span className="tabular-nums">{r.score}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{t("play.noScoresYet")}</p>
      )}
      {!user && <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{t("play.guestNote")}</p>}
      {user && data?.myBest != null && !data.top.some((r) => r.me) && (
        <p className="mt-3 border-t pt-3 text-sm">{t("play.yourWeekBest", { n: data.myBest })}</p>
      )}
    </section>
  );
}

export function FunHub() {
  const { t } = useT();
  const [lbGame, setLbGame] = useState<GameId>("speed");
  return (
    <Frame>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold sm:text-[28px]">{t("play.title")}</h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{t("play.sub")}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {GAMES.map((g) => {
            const best = readBest(g);
            return (
              <li key={g}>
                <Link
                  href={`/fun/${g}`}
                  data-testid={`game-${g}`}
                  className="group flex h-full flex-col rounded-lg border bg-card shadow-sm transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="paper-grid h-36 rounded-t-lg border-b px-4 py-3">
                    <Preview game={g} />
                  </div>
                  <div className="flex flex-1 items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold group-hover:text-primary">{t(`play.${g}.name`)}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{t(`play.${g}.desc`)}</p>
                    </div>
                    {best > 0 && (
                      <span className="shrink-0 text-right text-xs text-muted-foreground">
                        {t("play.best")}<span className="block font-hand text-2xl leading-none text-pen">{best}</span>
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <div>
          <h2 className="text-lg font-semibold">{t("play.leadersWeek")}</h2>
          <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label={t("play.leadersWeek")}>
            {GAMES.map((g) => (
              <button
                key={g}
                role="tab"
                aria-selected={lbGame === g}
                onClick={() => setLbGame(g)}
                data-testid={`lb-tab-${g}`}
                className={cn("h-9 rounded-md border px-3 text-sm font-medium transition-colors",
                  lbGame === g ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
              >
                {t(`play.${g}.name`)}
              </button>
            ))}
          </div>
          <div className="mt-3 max-w-md"><Leaderboard game={lbGame} /></div>
        </div>
      </div>
    </Frame>
  );
}

const COMPONENTS: Record<GameId, React.ComponentType<{ onFinish: (score: number) => void }>> = {
  speed: SpeedGame, merge: MergeGame, balance: BalanceGame, memory: MemoryGame,
};

export function FunGame({ game }: { game: string }) {
  const { t } = useT();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<{ score: number; record: boolean; saved: "no" | "saving" | "yes" | "error" } | null>(null);

  useEffect(() => { if (!isGame(game)) navigate("/fun"); }, [game, navigate]);

  const finish = useCallback((score: number) => {
    if (!isGame(game)) return;
    const record = score > readBest(game);
    if (record) writeBest(game, score);
    setResult({ score, record, saved: user && score > 0 ? "saving" : "no" });
    if (user && score > 0) {
      apiRequest("POST", "/api/games/scores", { game, score })
        .then(() => {
          setResult((r) => r && { ...r, saved: "yes" });
          queryClient.invalidateQueries({ queryKey: [`/api/games/leaderboard?game=${game}`] });
        })
        .catch(() => setResult((r) => r && { ...r, saved: "error" }));
    }
  }, [game, user]);

  if (!isGame(game)) return null;
  const Game = COMPONENTS[game];
  const again = () => { setResult(null); setRound((r) => r + 1); };

  return (
    <Frame>
      <div className="space-y-5">
        <div>
          <Link href="/fun" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground" data-testid="link-all-games">
            <ArrowLeft className="h-4 w-4" /> {t("play.allGames")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold sm:text-[28px]">{t(`play.${game}.name`)}</h1>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            {result ? (
              <div className="mx-auto flex max-w-md flex-col items-center rounded-lg border bg-card px-6 py-8 text-center shadow-sm" data-testid="game-result">
                <p className="text-sm text-muted-foreground">{t("play.yourScore")}</p>
                <p className="pen-write mt-1 font-hand text-7xl leading-none text-pen" data-testid="result-score">{result.score}</p>
                {result.record && result.score > 0 && <p className="mt-2 font-semibold text-correct">{t("play.newBest")}</p>}
                <p className="mt-3 min-h-5 text-sm text-muted-foreground">
                  {result.saved === "saving" && t("play.saving")}
                  {result.saved === "yes" && t("play.saved")}
                  {result.saved === "error" && t("play.saveFailed")}
                  {!user && t("play.guestNote")}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button onClick={again} className="gap-1.5 font-semibold" data-testid="button-play-again"><RotateCcw className="h-4 w-4" />{t("play.again")}</Button>
                  <Button variant="outline" asChild><Link href="/fun">{t("play.allGames")}</Link></Button>
                  {!user && <Button variant="outline" asChild><Link href="/">{t("play.signIn")}</Link></Button>}
                </div>
              </div>
            ) : (
              <Game key={round} onFinish={finish} />
            )}
          </div>
          <aside><Leaderboard game={game} compact /></aside>
        </div>
      </div>
    </Frame>
  );
}
