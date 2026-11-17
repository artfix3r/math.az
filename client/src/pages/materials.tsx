import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FolderPlus, FilePlus, Folder, ChevronRight, FileText, Film, Image as ImageIcon,
  Music, Youtube, Link as LinkIcon, File as FileIcon, Trash2, Download,
  ExternalLink, FolderOpen, Pencil,
} from "lucide-react";
import type { Group } from "@shared/schema";
import { uploadMaterialFile, maxUploadBytes, materialFileUrl } from "@/lib/upload";

// Material as returned by the API (teacher responses also include groupIds).
type Material = {
  id: number;
  teacherId: number;
  kind: "folder" | "file";
  name: string;
  parentId: number | null;
  fileType: "pdf" | "video" | "image" | "audio" | "youtube" | "link" | "other";
  dataUrl: string; // always "" from the API; use materialFileUrl()
  hasFile?: boolean;
  linkUrl: string;
  sizeBytes: number;
  visibility: "public" | "private";
  createdAt: number;
  groupIds?: number[];
};


function iconFor(m: Material) {
  if (m.kind === "folder") return Folder;
  switch (m.fileType) {
    case "pdf": return FileText;
    case "video": return Film;
    case "image": return ImageIcon;
    case "audio": return Music;
    case "youtube": return Youtube;
    case "link": return LinkIcon;
    default: return FileIcon;
  }
}

function fileTypeFromMime(mime: string): Material["fileType"] {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return "other";
}

function humanSize(bytes: number) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes; let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export default function Materials() {
  const { user } = useAuth();
  const { t } = useT();
  const isTeacher = user?.role === "teacher";
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);

  const { data: items, isLoading } = useQuery<Material[]>({ queryKey: ["/api/materials"] });

  // Build a lookup so we can render a breadcrumb trail for the current folder.
  const byId = useMemo(() => {
    const m = new Map<number, Material>();
    (items || []).forEach((it) => m.set(it.id, it));
    return m;
  }, [items]);

  const trail = useMemo(() => {
    const path: Material[] = [];
    let id = currentFolder;
    while (id != null && byId.has(id)) {
      const node = byId.get(id)!;
      path.unshift(node);
      id = node.parentId;
    }
    return path;
  }, [currentFolder, byId]);

  // Children of the folder we're viewing: folders first, then files, A→Z.
  const children = useMemo(() => {
    const list = (items || []).filter((it) => (it.parentId ?? null) === currentFolder);
    return list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [items, currentFolder]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-materials-title">{t("mat.title")}</h1>
          <p className="text-sm text-muted-foreground">{isTeacher ? t("mat.subTeacher") : t("mat.subStudent")}</p>
        </div>
        {isTeacher && (
          <div className="flex gap-2">
            <NewFolderDialog parentId={currentFolder} />
            <AddMaterialDialog parentId={currentFolder} />
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 text-sm font-bold">
        <button
          className="rounded-lg px-2 py-1 text-muted-foreground hover-elevate"
          onClick={() => setCurrentFolder(null)}
          data-testid="crumb-root"
        >
          {t("mat.root")}
        </button>
        {trail.map((node) => (
          <span key={node.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              className="rounded-lg px-2 py-1 text-muted-foreground hover-elevate"
              onClick={() => setCurrentFolder(node.id)}
              data-testid={`crumb-${node.id}`}
            >
              {node.name}
            </button>
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : children.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((m) => (
            <MaterialCard
              key={m.id}
              m={m}
              isTeacher={isTeacher}
              onOpenFolder={() => setCurrentFolder(m.id)}
            />
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FolderOpen className="h-7 w-7" />
          </span>
          <p className="mt-4 font-bold" data-testid="text-materials-empty">{t("mat.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isTeacher ? t("mat.emptyTeacher") : t("mat.emptyStudent")}
          </p>
        </Card>
      )}
    </div>
  );
}

function MaterialCard({
  m, isTeacher, onOpenFolder,
}: {
  m: Material; isTeacher: boolean; onOpenFolder: () => void;
}) {
  const { t } = useT();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const Icon = iconFor(m);

  const del = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/materials/${m.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({ title: t("mat.deleted") });
    },
  });

  const openLink = m.fileType === "youtube" || m.fileType === "link" ? m.linkUrl : materialFileUrl(m.id);

  return (
    <Card className="flex flex-col p-4" data-testid={`material-${m.id}`}>
      <button
        className="flex items-start gap-3 text-left"
        onClick={m.kind === "folder" ? onOpenFolder : undefined}
        disabled={m.kind !== "folder"}
        data-testid={m.kind === "folder" ? `open-folder-${m.id}` : undefined}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.kind === "folder" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold" data-testid={`material-name-${m.id}`}>{m.name}</p>
          <p className="text-xs text-muted-foreground">
            {m.kind === "folder"
              ? t("mat.folder")
              : [t(`mat.type${m.fileType === "youtube" ? "Youtube" : m.fileType === "link" ? "Link" : "Upload"}`), humanSize(m.sizeBytes)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </button>

      <div className="mt-3 flex items-center gap-2 border-t pt-3">
        {m.kind === "file" && isTeacher && (
          <Badge
            className={m.visibility === "public"
              ? "bg-teal-500 text-white"
              : "bg-violet-500 text-white"}
            data-testid={`badge-visibility-${m.id}`}
          >
            {m.visibility === "public" ? t("mat.badge.public") : t("mat.badge.private")}
          </Badge>
        )}

        {m.kind === "file" && (m.fileType === "youtube" || m.fileType === "link") && (
          <a href={openLink} target="_blank" rel="noopener noreferrer" data-testid={`link-open-${m.id}`}>
            <Button size="sm" variant="secondary" className="gap-1.5 font-bold">
              <ExternalLink className="h-3.5 w-3.5" /> {t("mat.open")}
            </Button>
          </a>
        )}

        {m.kind === "file" && m.fileType !== "youtube" && m.fileType !== "link" && (
          <>
            <a href={openLink} target="_blank" rel="noopener noreferrer" data-testid={`file-open-${m.id}`}>
              <Button size="sm" variant="secondary" className="gap-1.5 font-bold">
                <ExternalLink className="h-3.5 w-3.5" /> {t("mat.open")}
              </Button>
            </a>
            <a href={materialFileUrl(m.id, true)} data-testid={`download-${m.id}`}>
              <Button size="sm" variant="ghost" className="gap-1.5 font-bold">
                <Download className="h-3.5 w-3.5" /> {t("mat.download")}
              </Button>
            </a>
          </>
        )}

        {isTeacher && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto text-muted-foreground hover:text-primary"
              onClick={() => setEditOpen(true)}
              data-testid={`button-edit-${m.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <EditMaterialDialog m={m} open={editOpen} onOpenChange={setEditOpen} />
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
              data-testid={`button-delete-${m.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("mat.deleteConfirm", { name: m.name })}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {m.kind === "folder" ? t("mat.deleteFolderWarn") : t("mat.deleteFileWarn")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid={`button-delete-cancel-${m.id}`}>{t("mat.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => del.mutate()}
                    data-testid={`button-delete-confirm-${m.id}`}
                  >
                    {t("mat.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </Card>
  );
}

function NewFolderDialog({ parentId }: { parentId: number | null }) {
  const { t } = useT();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/materials", {
      kind: "folder",
      name: name.trim(),
      parentId,
      fileType: "other",
      visibility: "public",
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      setOpen(false);
      setName("");
      toast({ title: t("mat.folderAdded") });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" className="gap-1.5 font-bold" onClick={() => setOpen(true)} data-testid="button-new-folder">
        <FolderPlus className="h-4 w-4" /> {t("mat.newFolder")}
      </Button>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("mat.newFolder")}</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label className="font-bold">{t("mat.folderName")}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="input-folder-name"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} data-testid="button-folder-cancel">{t("mat.cancel")}</Button>
          <Button
            className="font-bold"
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
            data-testid="button-folder-create"
          >
            {t("mat.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type MatType = "upload" | "youtube" | "link";

function AddMaterialDialog({ parentId }: { parentId: number | null }) {
  const { t } = useT();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MatType>("upload");
  const [displayName, setDisplayName] = useState("");
  const [url, setUrl] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [groupIds, setGroupIds] = useState<number[]>([]);
  // Uploaded file state
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<Material["fileType"]>("other");
  const [sizeBytes, setSizeBytes] = useState(0);

  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/teacher/groups-simple"], enabled: open });

  function reset() {
    setType("upload"); setDisplayName(""); setUrl("");
    setVisibility("public"); setGroupIds([]);
    setFileName(""); setFile(null); setFileType("other"); setSizeBytes(0);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return;
    if (f.size > (await maxUploadBytes())) {
      toast({ title: t("mat.tooBig"), variant: "destructive" });
      input.value = "";
      return;
    }
    setFile(f);
    setFileName(f.name);
    setFileType(fileTypeFromMime(f.type));
    setSizeBytes(f.size);
  }

  const finalName = displayName.trim() || (type === "upload" ? fileName : url.trim());

  function valid() {
    if (type === "upload") return !!file && !!finalName;
    return !!url.trim() && !!finalName;
  }

  const create = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        kind: "file",
        name: finalName,
        parentId,
        visibility,
        groupIds: visibility === "private" ? groupIds : [],
      };
      if (type === "upload") {
        if (!file) throw new Error(t("mat.uploadFailed"));
        Object.assign(payload, await uploadMaterialFile(file));
        payload.fileType = fileType;
        payload.sizeBytes = sizeBytes;
      } else if (type === "youtube") {
        payload.fileType = "youtube";
        payload.linkUrl = url.trim();
      } else {
        payload.fileType = "link";
        payload.linkUrl = url.trim();
      }
      return (await apiRequest("POST", "/api/materials", payload)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      setOpen(false);
      reset();
      toast({ title: t("mat.added") });
    },
    onError: (err: any) => {
      toast({ title: t("mat.uploadFailed"), description: err?.message, variant: "destructive" });
    },
  });

  function toggleGroup(id: number) {
    setGroupIds((prev) => prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <Button className="gap-1.5 font-bold" onClick={() => setOpen(true)} data-testid="button-add-material">
        <FilePlus className="h-4 w-4" /> {t("mat.addMaterial")}
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("mat.addMaterial")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Type */}
          <div className="space-y-1.5">
            <Label className="font-bold">{t("mat.type")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["upload", "youtube", "link"] as MatType[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setType(opt)}
                  data-testid={`type-${opt}`}
                  className={`rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition-colors ${
                    type === opt ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover-elevate"
                  }`}
                >
                  {opt === "upload" ? t("mat.typeUpload") : opt === "youtube" ? t("mat.typeYoutube") : t("mat.typeLink")}
                </button>
              ))}
            </div>
          </div>

          {/* Source */}
          {type === "upload" ? (
            <div className="space-y-1.5">
              <Label className="font-bold">{t("mat.chooseFile")}</Label>
              <Input type="file" onChange={onFile} data-testid="input-file" />
              {fileName && <p className="text-xs text-muted-foreground" data-testid="text-file-chosen">{t("mat.fileChosen", { name: fileName })}</p>}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="font-bold">{type === "youtube" ? t("mat.youtubeUrl") : t("mat.url")}</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={type === "youtube" ? "https://youtube.com/watch?v=…" : "https://…"}
                data-testid="input-url"
              />
            </div>
          )}

          {/* Display name */}
          <div className="space-y-1.5">
            <Label className="font-bold">{t("mat.displayName")}</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={type === "upload" ? fileName : url}
              data-testid="input-display-name"
            />
            <p className="text-xs text-muted-foreground">{t("mat.displayNameHint")}</p>
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <Label className="font-bold">{t("mat.visibility")}</Label>
            <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as "public" | "private")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="public" id="vis-public" data-testid="visibility-public" />
                <Label htmlFor="vis-public" className="font-normal">{t("mat.public")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="private" id="vis-private" data-testid="visibility-private" />
                <Label htmlFor="vis-private" className="font-normal">{t("mat.private")}</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Group picker for private */}
          {visibility === "private" && (
            <div className="space-y-2 rounded-xl border bg-muted/40 p-3">
              <Label className="font-bold">{t("mat.pickGroups")}</Label>
              {groups && groups.length > 0 ? (
                <div className="space-y-2">
                  {groups.map((g) => (
                    <div key={g.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`grp-${g.id}`}
                        checked={groupIds.includes(g.id)}
                        onCheckedChange={() => toggleGroup(g.id)}
                        data-testid={`group-checkbox-${g.id}`}
                      />
                      <Label htmlFor={`grp-${g.id}`} className="font-normal">{g.name}</Label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("mat.noGroups")}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOpen(false); reset(); }} data-testid="button-material-cancel">{t("mat.cancel")}</Button>
          <Button
            className="font-bold"
            disabled={!valid() || create.isPending || (visibility === "private" && groupIds.length === 0)}
            onClick={() => create.mutate()}
            data-testid="button-material-create"
          >
            {create.isPending ? t("mat.uploading") : t("mat.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditMaterialDialog({
  m, open, onOpenChange,
}: {
  m: Material; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const { t } = useT();
  const { toast } = useToast();
  const isFolder = m.kind === "folder";
  const isLink = m.fileType === "youtube" || m.fileType === "link";

  const [name, setName] = useState(m.name);
  const [url, setUrl] = useState(m.linkUrl);
  const [visibility, setVisibility] = useState<"public" | "private">(m.visibility);
  const [groupIds, setGroupIds] = useState<number[]>(m.groupIds ?? []);
  // Optional file replacement (uploads only)
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newFileType, setNewFileType] = useState<Material["fileType"]>(m.fileType);
  const [newSizeBytes, setNewSizeBytes] = useState(0);
  const [newFileName, setNewFileName] = useState("");

  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/teacher/groups-simple"], enabled: open && !isFolder });

  // Re-seed local state whenever the dialog (re)opens for this material.
  function syncFromProps() {
    setName(m.name);
    setUrl(m.linkUrl);
    setVisibility(m.visibility);
    setGroupIds(m.groupIds ?? []);
    setNewFile(null); setNewFileType(m.fileType); setNewSizeBytes(0); setNewFileName("");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return;
    if (f.size > (await maxUploadBytes())) {
      toast({ title: t("mat.tooBig"), variant: "destructive" });
      input.value = "";
      return;
    }
    setNewFile(f);
    setNewFileType(fileTypeFromMime(f.type));
    setNewSizeBytes(f.size);
    setNewFileName(f.name);
  }

  function toggleGroup(id: number) {
    setGroupIds((prev) => prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { name: name.trim() };
      if (!isFolder) {
        payload.visibility = visibility;
        payload.groupIds = visibility === "private" ? groupIds : [];
        if (isLink) {
          payload.linkUrl = url.trim();
        } else if (newFile) {
          // Teacher chose to replace the underlying file.
          Object.assign(payload, await uploadMaterialFile(newFile));
          payload.fileType = newFileType;
          payload.sizeBytes = newSizeBytes;
        }
      }
      return (await apiRequest("PATCH", `/api/materials/${m.id}`, payload)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      onOpenChange(false);
      toast({ title: t("mat.saved") });
    },
    onError: (err: any) => {
      toast({ title: t("mat.uploadFailed"), description: err?.message, variant: "destructive" });
    },
  });

  const valid =
    !!name.trim() &&
    (isFolder || !isLink || !!url.trim()) &&
    (isFolder || visibility === "public" || groupIds.length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) syncFromProps(); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isFolder ? t("mat.editFolder") : t("mat.editMaterial")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="font-bold">{isFolder ? t("mat.folderName") : t("mat.displayName")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-edit-name"
              autoFocus
            />
          </div>

          {!isFolder && isLink && (
            <div className="space-y-1.5">
              <Label className="font-bold">{m.fileType === "youtube" ? t("mat.youtubeUrl") : t("mat.url")}</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} data-testid="input-edit-url" />
            </div>
          )}

          {!isFolder && !isLink && (
            <div className="space-y-1.5">
              <Label className="font-bold">{t("mat.replaceFile")}</Label>
              <Input type="file" onChange={onFile} data-testid="input-edit-file" />
              {newFileName
                ? <p className="text-xs text-muted-foreground" data-testid="text-edit-file-chosen">{t("mat.fileChosen", { name: newFileName })}</p>
                : <p className="text-xs text-muted-foreground">{t("mat.keepFile")}</p>}
            </div>
          )}

          {/* Visibility (files only) */}
          {!isFolder && (
            <>
              <div className="space-y-2">
                <Label className="font-bold">{t("mat.visibility")}</Label>
                <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as "public" | "private")}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="public" id={`evis-public-${m.id}`} data-testid="edit-visibility-public" />
                    <Label htmlFor={`evis-public-${m.id}`} className="font-normal">{t("mat.public")}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="private" id={`evis-private-${m.id}`} data-testid="edit-visibility-private" />
                    <Label htmlFor={`evis-private-${m.id}`} className="font-normal">{t("mat.private")}</Label>
                  </div>
                </RadioGroup>
              </div>

              {visibility === "private" && (
                <div className="space-y-2 rounded-xl border bg-muted/40 p-3">
                  <Label className="font-bold">{t("mat.pickGroups")}</Label>
                  {groups && groups.length > 0 ? (
                    <div className="space-y-2">
                      {groups.map((g) => (
                        <div key={g.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`egrp-${m.id}-${g.id}`}
                            checked={groupIds.includes(g.id)}
                            onCheckedChange={() => toggleGroup(g.id)}
                            data-testid={`edit-group-checkbox-${g.id}`}
                          />
                          <Label htmlFor={`egrp-${m.id}-${g.id}`} className="font-normal">{g.name}</Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("mat.noGroups")}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-edit-cancel">{t("mat.cancel")}</Button>
          <Button
            className="font-bold"
            disabled={!valid || save.isPending}
            onClick={() => save.mutate()}
            data-testid="button-edit-save"
          >
            {save.isPending ? t("mat.uploading") : t("mat.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
