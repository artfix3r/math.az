import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useT, formatDateTime } from "@/lib/i18n";
import { Users2, Copy, Link2Off, RefreshCw, Loader2 } from "lucide-react";

type Status = { active: boolean; createdAt?: number };

/**
 * Create / copy / switch off the parent link. `studentId` = a teacher acting
 * for that student; omitted = the signed-in student. The link itself is shown
 * only right after it's made (the server keeps just a hash of it).
 */
export function ParentLinkCard({ studentId }: { studentId?: number }) {
  const { t } = useT();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const forSelf = studentId === undefined;
  const { data: status } = useQuery<Status>({ queryKey: ["/api/parent-link"], enabled: forSelf });

  const create = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", forSelf ? "/api/parent-link" : `/api/students/${studentId}/parent-link`)).json() as Promise<{ url: string }>,
    onSuccess: (r) => {
      // Use this site's own address, so the link works on test and live sites alike.
      const token = r.url.split("/#/parent/")[1];
      setUrl(`${window.location.origin}/#/parent/${token}`);
      if (forSelf) queryClient.invalidateQueries({ queryKey: ["/api/parent-link"] });
    },
    onError: (e: Error) => toast({ title: t("parent.failed"), description: e.message, variant: "destructive" }),
  });
  const off = useMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/parent-link"),
    onSuccess: () => { setUrl(""); queryClient.invalidateQueries({ queryKey: ["/api/parent-link"] }); toast({ title: t("parent.turnedOff") }); },
  });
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast({ title: t("parent.copied") }); } catch { /* user can select the text */ }
  };

  const active = forSelf ? status?.active : false;
  return (
    <Card className="space-y-3 p-5" data-testid="card-parent-link">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users2 className="h-5 w-5" /></span>
        <div>
          <h2 className="font-bold">{t("parent.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("parent.desc")}</p>
        </div>
      </div>
      {url ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.target.select()} data-testid="input-parent-url" />
            <Button onClick={copy} className="gap-1.5 font-bold"><Copy className="h-4 w-4" /> {t("parent.copy")}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("parent.onlyOnce")}</p>
        </div>
      ) : active ? (
        <p className="text-sm">{t("parent.activeSince", { date: formatDateTime(status!.createdAt!) })}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant={url || active ? "outline" : "default"} onClick={() => create.mutate()} disabled={create.isPending} className="gap-1.5 font-bold" data-testid="button-parent-create">
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {url || active ? t("parent.newLink") : t("parent.create")}
        </Button>
        {forSelf && (active || url) && (
          <Button variant="ghost" onClick={() => off.mutate()} className="gap-1.5 font-bold text-muted-foreground hover:text-destructive">
            <Link2Off className="h-4 w-4" /> {t("parent.turnOff")}
          </Button>
        )}
      </div>
      {(url || active) && <p className="text-xs text-muted-foreground">{t("parent.newLinkHint")}</p>}
    </Card>
  );
}
