import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { colorOf } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, UserPlus, Trash2, Loader2, Users } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { Group } from "@shared/schema";

type Member = { id: number; fullName: string; email: string; username: string; avatarColor: string };
type GroupWithCount = Group & { memberCount: number };

export default function GroupDetail({ id }: { id: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useT();
  const [, navigate] = useLocation();
  const isTeacher = user?.role === "teacher";
  const [identifier, setIdentifier] = useState("");

  const { data: groups } = useQuery<GroupWithCount[]>({ queryKey: ["/api/groups"] });
  const group = groups?.find((g) => g.id === id);
  const { data: members, isLoading } = useQuery<Member[]>({ queryKey: ["/api/groups", id, "members"] });

  const addMember = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/groups/${id}/members`, { identifier })).json(),
    onSuccess: (m: Member) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setIdentifier("");
      toast({ title: t("gd.studentAdded"), description: m.fullName });
    },
    onError: (e: any) => toast({ title: t("gd.cantAdd"), description: e.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: async (sid: number) => apiRequest("DELETE", `/api/groups/${id}/members/${sid}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
    },
  });

  const deleteGroup = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      navigate("/groups");
      toast({ title: t("gd.groupDeleted") });
    },
  });

  const c = colorOf(group?.color);

  return (
    <div className="space-y-6">
      <Link href="/groups" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("gd.back")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", c.bg, c.text)}>
            <Users className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-3xl font-black tracking-tight">{group?.name ?? t("groups.title")}</h1>
            {group?.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
          </div>
        </div>
        {isTeacher && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2 font-bold text-destructive" data-testid="button-delete-group"><Trash2 className="h-4 w-4" /> {t("common.delete")}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("gd.deleteGroup")}</AlertDialogTitle>
                <AlertDialogDescription>{t("gd.deleteGroupDesc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteGroup.mutate()} className="bg-destructive text-destructive-foreground">{t("common.delete")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {isTeacher && (
        <Card className="p-5">
          <p className="font-black">{t("gd.addStudent")}</p>
          <p className="mb-3 text-sm text-muted-foreground">{t("gd.addStudentSub")}</p>
          <form
            onSubmit={(e) => { e.preventDefault(); if (identifier) addMember.mutate(); }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={t("gd.addStudentPlaceholder")} data-testid="input-add-student" />
            <Button type="submit" disabled={!identifier || addMember.isPending} className="gap-2 font-bold" data-testid="button-add-student">
              {addMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} {t("common.add")}
            </Button>
          </form>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-black">{t("gd.studentsHeading")} {members && `(${members.length})`}</h2>
        {isLoading ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : members && members.length > 0 ? (
          <div className="grid gap-2">
            {members.map((m) => {
              const mc = colorOf(m.avatarColor);
              return (
                <Card key={m.id} className="flex items-center gap-3 p-3" data-testid={`member-${m.id}`}>
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-full font-extrabold", mc.bg, mc.text)}>
                    {m.fullName[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    {isTeacher ? (
                      <Link href={`/students/${m.id}/progress`} className="truncate font-bold hover:text-primary hover:underline" data-testid={`link-progress-${m.id}`}>{m.fullName}</Link>
                    ) : (
                      <p className="truncate font-bold">{m.fullName}</p>
                    )}
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  {isTeacher && (
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => removeMember.mutate(m.id)} data-testid={`button-remove-${m.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="flex items-center justify-center border-dashed p-10 text-sm text-muted-foreground">{t("gd.noStudents")}</Card>
        )}
      </div>
    </div>
  );
}
