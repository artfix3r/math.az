import { StorageClient } from "@supabase/storage-js";
import { apiRequest, ApiError } from "./queryClient";

// Uploading learning materials.
//
// When the server has file storage (Supabase) configured, the browser asks the
// server for a one-time signed upload URL and sends the file straight to
// storage, so big files never go through our API. Otherwise it falls back to
// the old behaviour: the file is embedded in the request as a base64 data URL
// (small files only, because hosts like Vercel cap request bodies at 4.5 MB).

type StorageConfig =
  | { enabled: true; url: string; bucket: string; publicKey: string; maxBytes: number }
  | { enabled: false };

/** Size limit when files are embedded in the database (no storage). */
export const LEGACY_MAX_BYTES = 3 * 1024 * 1024; // 3 MB

let configPromise: Promise<StorageConfig> | null = null;
function getStorageConfig(): Promise<StorageConfig> {
  if (!configPromise) {
    configPromise = apiRequest("GET", "/api/storage/config")
      .then((r) => r.json() as Promise<StorageConfig>)
      .catch((e) => {
        configPromise = null;
        throw e;
      });
  }
  return configPromise;
}

/** Largest file the user may pick right now. */
export async function maxUploadBytes(): Promise<number> {
  const cfg = await getStorageConfig().catch(() => ({ enabled: false }) as StorageConfig);
  return cfg.enabled ? cfg.maxBytes : LEGACY_MAX_BYTES;
}

const tooLarge = (maxBytes: number) =>
  new ApiError(413, "file_too_large", { max: String(Math.round(maxBytes / 1024 / 1024)) });

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new ApiError(0, "upload_failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads `file` and returns the fields to send with the material
 * (either { storagePath, mimeType } or the legacy { dataUrl, mimeType }).
 */
export async function uploadMaterialFile(
  file: File,
): Promise<{ storagePath?: string; dataUrl?: string; mimeType: string }> {
  const cfg = await getStorageConfig();
  const mimeType = file.type || "application/octet-stream";
  if (!cfg.enabled) {
    if (file.size > LEGACY_MAX_BYTES) throw tooLarge(LEGACY_MAX_BYTES);
    return { dataUrl: await readAsDataUrl(file), mimeType };
  }
  if (file.size > cfg.maxBytes) throw tooLarge(cfg.maxBytes);
  const { path, token } = (await (
    await apiRequest("POST", "/api/materials/upload-url", { fileName: file.name, sizeBytes: file.size })
  ).json()) as { path: string; token: string };

  const headers: Record<string, string> = cfg.publicKey
    ? { apikey: cfg.publicKey, Authorization: `Bearer ${cfg.publicKey}` }
    : {};
  const client = new StorageClient(`${cfg.url}/storage/v1`, headers);
  const { error } = await client
    .from(cfg.bucket)
    .uploadToSignedUrl(path, token, file, { contentType: mimeType, upsert: false });
  if (error) throw new ApiError(0, "upload_failed");
  return { storagePath: path, mimeType };
}

/** Link that opens (or downloads) a material's file after the server's access check. */
export const materialFileUrl = (id: number, download = false) =>
  `/api/materials/${id}/file${download ? "?download=1" : ""}`;
