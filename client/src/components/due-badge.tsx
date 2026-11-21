import { Badge } from "@/components/ui/badge";
import { useT, formatDateTime } from "@/lib/i18n";
import { deadlineState } from "@shared/deadlines";
import { AlarmClock } from "lucide-react";
import { cn } from "@/lib/utils";

export const formatDue = (ts: number) => formatDateTime(ts);

/** "Due Fri 18:00" — amber when under a day left, red once the deadline has passed. */
export function DueBadge({ dueAt, className }: { dueAt?: number | null; className?: string }) {
  const { t } = useT();
  const state = deadlineState(dueAt, Date.now());
  if (state === "none") return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-bold",
        state === "soon" && "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        state === "closed" && "border-destructive bg-destructive/10 text-destructive",
        className,
      )}
      data-testid="badge-due"
    >
      <AlarmClock className="h-3 w-3" />
      {state === "closed" ? t("due.passed", { date: formatDue(dueAt!) }) : t("due.by", { date: formatDue(dueAt!) })}
    </Badge>
  );
}
