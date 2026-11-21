import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { LanguageSwitcher } from "@/pages/shell";
import { useT } from "@/lib/i18n";
import { ProgressReportView } from "@/components/progress-report";
import type { ProgressReport } from "@shared/progress";

/** Public, read-only progress page opened from a parent link. No sign-in. */
export default function ParentView({ token }: { token: string }) {
  const { t } = useT();
  const { data, isLoading, isError } = useQuery<ProgressReport & { student: { fullName: string } }>({
    queryKey: ["/api/parent", token],
    retry: false,
  });
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="flex items-center justify-between border-b bg-background px-6 py-3">
        <span className="text-lg font-bold">math<span className="text-primary">.az</span></span>
        <LanguageSwitcher />
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        {isError ? (
          <Card className="p-10 text-center">
            <h1 className="text-xl font-bold">{t("parent.invalidTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("parent.invalidDesc")}</p>
          </Card>
        ) : isLoading || !data ? (
          <Skeleton className="h-96 rounded-lg" />
        ) : (
          <>
            <div>
              <p className="text-sm font-bold text-primary">{t("parent.viewLabel")}</p>
              <h1 className="text-2xl font-bold sm:text-[28px]">{data.student.fullName}</h1>
              <p className="text-sm text-muted-foreground">{t("parent.viewSub")}</p>
            </div>
            <ProgressReportView report={data} />
          </>
        )}
      </main>
    </div>
  );
}
