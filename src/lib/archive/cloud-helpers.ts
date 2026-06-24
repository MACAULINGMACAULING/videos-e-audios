import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks the storage origin of each Blob loaded from the cloud so subsequent
 * saves don't re-upload unchanged binaries. New Blobs from <input type="file">
 * have no entry and are uploaded fresh.
 */
const blobOrigin = new WeakMap<Blob, { bucket: string; path: string }>();

export function rememberOrigin(blob: Blob, bucket: string, path: string) {
  blobOrigin.set(blob, { bucket, path });
}

export function getOrigin(blob: Blob): { bucket: string; path: string } | undefined {
  return blobOrigin.get(blob);
}

export async function requireOwnerId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Não autenticado.");
  return data.user.id;
}

/**
 * Uploads the blob to the given path if it was not previously downloaded from
 * cloud storage. Returns the canonical storage path.
 */
export async function uploadIfNew(
  bucket: string,
  path: string,
  blob: Blob,
): Promise<string> {
  const origin = blobOrigin.get(blob);
  if (origin && origin.bucket === bucket && origin.path === path) return origin.path;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { upsert: true, contentType: blob.type || "application/octet-stream" });
  if (error) throw new Error(`Falha ao enviar ${path}: ${error.message}`);
  rememberOrigin(blob, bucket, path);
  return path;
}

export async function downloadBlob(bucket: string, path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Falha ao baixar ${path}: ${error?.message ?? "vazio"}`);
  rememberOrigin(data, bucket, path);
  return data;
}

export async function removeFiles(bucket: string, paths: string[]) {
  if (paths.length === 0) return;
  await supabase.storage.from(bucket).remove(paths);
}

export function shortPublicId(): string {
  // Short, URL-safe, collision-resistant enough for hand-shareable links.
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10);
}
