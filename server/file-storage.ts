import { StorageClient } from "@supabase/storage-js";
import { randomUUID } from "node:crypto";

// Uploaded learning materials live in a private Supabase Storage bucket, not in
// the database. The browser uploads straight to Supabase with a one-time signed
// upload URL (so large files never pass through our server or hit Vercel's
// 4.5 MB request limit), and downloads go through short-lived signed links
// that we only hand out after checking the user may see the file.
//
// Configure with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server only; never
// expose the service key to the browser). SUPABASE_BUCKET defaults to
// "materials". If these are not set, storage is "disabled" and the app falls
// back to the old behaviour of storing small files inside the database.

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
// Public (anon / publishable) key — safe to send to the browser. Optional:
// signed upload URLs carry their own token.
const PUBLIC_KEY = process.env.SUPABASE_ANON_KEY || "";
export const BUCKET = process.env.SUPABASE_BUCKET || "materials";

/** Max size of one uploaded file when using storage. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB

const client =
  SUPABASE_URL && SERVICE_KEY
    ? new StorageClient(`${SUPABASE_URL}/storage/v1`, {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      })
    : null;

export const isStorageEnabled = () => client !== null;

/** What the browser needs to upload directly to storage. */
export function publicStorageConfig() {
  return client
    ? { enabled: true as const, url: SUPABASE_URL, bucket: BUCKET, publicKey: PUBLIC_KEY, maxBytes: MAX_UPLOAD_BYTES }
    : { enabled: false as const };
}

// Create the private bucket the first time it is needed (idempotent).
let bucketReady: Promise<void> | null = null;
function ensureBucket(): Promise<void> {
  if (!client) return Promise.reject(new Error("File storage is not configured"));
  if (!bucketReady) {
    bucketReady = (async () => {
      const { error } = await client.getBucket(BUCKET);
      if (!error) return;
      const created = await client.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: MAX_UPLOAD_BYTES,
      });
      if (created.error && !/exist/i.test(created.error.message)) throw created.error;
    })().catch((e) => {
      bucketReady = null; // retry next time
      throw e;
    });
  }
  return bucketReady;
}

function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.]+/, "")
    .slice(-100);
  return cleaned || "file";
}

/** Every file a teacher uploads is stored under "<teacherId>/...". */
export const teacherPrefix = (teacherId: number) => `${teacherId}/`;

export async function createUploadUrl(teacherId: number, fileName: string) {
  await ensureBucket();
  const path = `${teacherPrefix(teacherId)}${randomUUID()}/${safeFileName(fileName)}`;
  const { data, error } = await client!.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("Could not create upload URL");
  return { path: data.path, token: data.token };
}

/** Short-lived link to view or download a stored file. */
export async function createDownloadUrl(path: string, downloadName?: string) {
  if (!client) throw new Error("File storage is not configured");
  const { data, error } = await client
    .from(BUCKET)
    .createSignedUrl(path, 60 * 10, downloadName ? { download: downloadName } : undefined);
  if (error || !data) throw error ?? new Error("Could not create download URL");
  return data.signedUrl;
}

/** Best-effort delete; never throws (a leftover file is harmless). */
export async function removeFiles(paths: string[]) {
  const list = paths.filter(Boolean);
  if (!client || list.length === 0) return;
  try {
    await client.from(BUCKET).remove(list);
  } catch (e) {
    console.warn("[storage] failed to remove files", e);
  }
}
