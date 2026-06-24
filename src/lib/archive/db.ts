import { supabase } from "@/integrations/supabase/client";
import type { ArchiveFile, ArchiveMeta, VideoArchive, MediaFormat, ViewerId, Resolution } from "./types";
import { DEFAULT_EFFECTS, type VhsEffects } from "@/lib/tape-types";
import {
  downloadBlob,
  removeFiles,
  requireOwnerId,
  uploadIfNew,
} from "./cloud-helpers";

const BUCKET = "archive-files";

function tokenPath(owner: string, id: string) { return `${owner}/${id}/token`; }
function payloadPath(owner: string, id: string) { return `${owner}/${id}/payload`; }

interface ArchiveRow {
  id: string;
  owner_id: string;
  kind: string;
  name: string;
  description: string;
  format: MediaFormat;
  compatible_viewers: string[];
  autoplay: boolean;
  loop: boolean;
  token_path: string | null;
  token_type: string | null;
  payload_path: string | null;
  payload_mime: string | null;
  payload_extra: { resolution?: Resolution; effects?: VhsEffects } & Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function rowToMeta(r: ArchiveRow): ArchiveMeta {
  return {
    id: r.id,
    kind: r.kind as ArchiveMeta["kind"],
    name: r.name,
    description: r.description,
    tokenType: r.token_type ?? "image/png",
    format: r.format,
    compatibleViewers: r.compatible_viewers as ViewerId[],
    autoplay: r.autoplay,
    loop: r.loop,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

export async function listArchives(): Promise<ArchiveMeta[]> {
  const { data, error } = await supabase
    .from("archives")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as ArchiveRow[]).map(rowToMeta);
}

export async function getArchive(id: string): Promise<ArchiveFile | undefined> {
  const { data, error } = await supabase.from("archives").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const r = data as unknown as ArchiveRow;

  if (r.kind !== "video" || !r.token_path || !r.payload_path) return undefined;

  const [token, video] = await Promise.all([
    downloadBlob(BUCKET, r.token_path),
    downloadBlob(BUCKET, r.payload_path),
  ]);

  const archive: VideoArchive = {
    id: r.id,
    kind: "video",
    name: r.name,
    description: r.description,
    token,
    tokenType: r.token_type ?? "image/png",
    format: r.format,
    compatibleViewers: r.compatible_viewers as ViewerId[],
    autoplay: r.autoplay,
    loop: r.loop,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
    payload: {
      video,
      videoType: r.payload_mime ?? "video/mp4",
      resolution: (r.payload_extra?.resolution as Resolution) ?? "1280x720",
      effects: r.payload_extra?.effects ?? DEFAULT_EFFECTS,
    },
  };
  return archive;
}

export async function saveArchive(a: ArchiveFile): Promise<void> {
  if (a.kind !== "video") throw new Error("Tipo de arquivo não suportado ainda.");
  const owner = await requireOwnerId();

  // Ensure DB row first (so id is reserved). Use upsert for both create and edit.
  const tPath = tokenPath(owner, a.id);
  const pPath = payloadPath(owner, a.id);

  await Promise.all([
    uploadIfNew(BUCKET, tPath, a.token),
    uploadIfNew(BUCKET, pPath, a.payload.video),
  ]);

  const { error } = await supabase.from("archives").upsert({
    id: a.id,
    owner_id: owner,
    kind: a.kind,
    name: a.name,
    description: a.description,
    format: a.format as never,
    compatible_viewers: a.compatibleViewers,
    autoplay: a.autoplay,
    loop: a.loop,
    token_path: tPath,
    token_type: a.tokenType,
    payload_path: pPath,
    payload_mime: a.payload.videoType,
    payload_extra: {
      resolution: a.payload.resolution,
      effects: a.payload.effects as unknown as Record<string, number>,
    } as never,
  });
  if (error) throw error;
}

export async function deleteArchive(id: string): Promise<void> {
  const owner = await requireOwnerId();
  await removeFiles(BUCKET, [tokenPath(owner, id), payloadPath(owner, id)]);
  const { error } = await supabase.from("archives").delete().eq("id", id);
  if (error) throw error;
}
