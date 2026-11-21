import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n";
import { ProgressReportView } from "@/components/progress-report";
import { ParentLinkCard } from "@/components/parent-link";
import { ArrowLeft } from "lucide-react";
import type { ProgressReport } from "@shared/progress";

/** The signed-in student's own progress. */
export function MyProgress() {
  const { t } = useT();
  const { data, isLoading } = useQuery<ProgressReport>({ queryKey: ["/api/progress"] });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-[28px]">{t("prog.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("prog.sub")}</p>
      </div>
      {isLoading || !data ? <Skeleton className="h-96 rounded-lg" /> : <ProgressReportView report={data} />}
      <ParentLinkCard />
    </div>
  );
}

/** A teacher looking at one of their students. */
export function StudentProgress({ id }: { id: number }) {
  const { t } = useT();
  const { data, isLoading } = useQuery<ProgressReport & { student: { id: number; fullName: string } }>({
    queryKey: ["/api/students", id, "progress"],
  });
  return (
    <div className="space-y-6">
      <button type="button" onClick={() => history.back()} className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("prog.back")}
      </button>
      <div>
        <h1 className="text-2xl font-bold sm:text-[28px]">{data?.student.fullName ?? "…"}</h1>
        <p className="text-sm text-muted-foreground">{t("prog.teacherSub")}</p>
      </div>
      {isLoading || !data ? <Skeleton className="h-96 rounded-lg" /> : <ProgressReportView report={data} />}
      <ParentLinkCard studentId={id} />
    </div>
  );
}
