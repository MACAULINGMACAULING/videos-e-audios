import { supabase } from "@/integrations/supabase/client";
import type {
  AudioDisplayMode,
  ControlAction,
  CustomViewer,
  CustomViewerMeta,
  DeviceType,
  ViewerResolution,
} from "./viewer-types";
import type { ArchiveKind } from "./types";
import {
  downloadBlob,
  removeFiles,
  requireOwnerId,
  shortPublicId,
  uploadIfNew,
} from "./cloud-helpers";

const BUCKET = "viewer-assets";

function bgPath(owner: string, id: string) { return `${owner}/${id}/background`; }
function tokPath(owner: string, id: string) { return `${owner}/${id}/token`; }
function soundPath(owner: string, id: string, key: string) { return `${owner}/${id}/sounds/${key}`; }

interface ViewerRow {
  id: string;
  owner_id: string;
  public_id: string;
  slug: string;
  name: string;
  accepts: string[];
  controls: Record<ControlAction, boolean>;
  resolution: string;
  background_path: string | null;
  background_type: string | null;
  token_path: string | null;
  token_type: string | null;
  sounds: Record<string, { path: string; mime: string }>;
  scene: { items: unknown[] };
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

function readSceneMeta(r: ViewerRow): {
  respectMediaControls: boolean;
  deviceType: DeviceType;
  hasScreen: boolean;
  audioDisplayMode: AudioDisplayMode;
} {
  const s = (r.scene ?? {}) as {
    respectMediaControls?: boolean;
    deviceType?: DeviceType;
    hasScreen?: boolean;
    audioDisplayMode?: AudioDisplayMode;
  };
  const accepts = (r.accepts ?? []) as ArchiveKind[];
  const inferredType: DeviceType =
    accepts.length === 1 && accepts[0] === "audio"
      ? "audio"
      : accepts.length > 1
        ? "mixed"
        : "video";
  const deviceType = s.deviceType ?? inferredType;
  return {
    respectMediaControls: s.respectMediaControls ?? true,
    deviceType,
    hasScreen: s.hasScreen ?? deviceType !== "audio",
    audioDisplayMode: s.audioDisplayMode ?? "token",
  };
}

function rowToMeta(r: ViewerRow): CustomViewerMeta & { publicId: string } {
  const m = readSceneMeta(r);
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    deviceType: m.deviceType,
    hasScreen: m.hasScreen,
    accepts: r.accepts as ArchiveKind[],
    controls: r.controls,
    resolution: r.resolution as ViewerResolution,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
    publicId: r.public_id,
  };
}

async function rowToFull(r: ViewerRow): Promise<CustomViewer> {
  const [background, token, ...soundBlobs] = await Promise.all([
    r.background_path ? downloadBlob(BUCKET, r.background_path) : Promise.resolve(null),
    r.token_path ? downloadBlob(BUCKET, r.token_path) : Promise.resolve(null),
    ...Object.entries(r.sounds ?? {}).map(([, v]) => downloadBlob(BUCKET, v.path)),
  ]);

  const sounds: CustomViewer["sounds"] = {};
  const entries = Object.entries(r.sounds ?? {});
  entries.forEach(([k, v], i) => {
    sounds[k as ControlAction | "insert"] = { blob: soundBlobs[i], mime: v.mime };
  });

  const meta = readSceneMeta(r);

  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    deviceType: meta.deviceType,
    hasScreen: meta.hasScreen,
    audioDisplayMode: meta.audioDisplayMode,
    accepts: r.accepts as ArchiveKind[],
    controls: r.controls,
    respectMediaControls: meta.respectMediaControls,
    resolution: r.resolution as ViewerResolution,
    background,
    backgroundType: r.background_type,
    token,
    tokenType: r.token_type,
    sounds,
    scene: { items: [] },
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

export async function listViewers(): Promise<(CustomViewerMeta & { publicId: string })[]> {
  const { data, error } = await supabase
    .from("viewers")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as ViewerRow[]).map(rowToMeta);
}

export async function getViewer(id: string): Promise<CustomViewer | undefined> {
  const { data, error } = await supabase.from("viewers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return rowToFull(data as unknown as ViewerRow);
}

export async function getViewerPublicId(id: string): Promise<string | undefined> {
  const { data, error } = await supabase
    .from("viewers")
    .select("public_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as { public_id: string } | null)?.public_id;
}

export async function getPublicViewerByPublicId(publicId: string): Promise<CustomViewer | undefined> {
  const { data, error } = await supabase
    .from("viewers")
    .select("*")
    .eq("public_id", publicId)
    .eq("is_public", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return rowToFull(data as unknown as ViewerRow);
}

export async function saveViewer(v: CustomViewer): Promise<{ publicId: string }> {
  const owner = await requireOwnerId();

  // Lookup existing public_id (preserved across edits).
  const existing = await supabase
    .from("viewers")
    .select("public_id")
    .eq("id", v.id)
    .maybeSingle();
  const publicId = (existing.data as { public_id: string } | null)?.public_id ?? shortPublicId();

  // Upload assets in parallel.
  const ops: Promise<unknown>[] = [];
  let bgPathFinal: string | null = null;
  let tokPathFinal: string | null = null;
  const soundsOut: Record<string, { path: string; mime: string }> = {};

  if (v.background) {
    bgPathFinal = bgPath(owner, v.id);
    ops.push(uploadIfNew(BUCKET, bgPathFinal, v.background));
  }
  if (v.token) {
    tokPathFinal = tokPath(owner, v.id);
    ops.push(uploadIfNew(BUCKET, tokPathFinal, v.token));
  }
  for (const [key, s] of Object.entries(v.sounds)) {
    if (!s) continue;
    const p = soundPath(owner, v.id, key);
    soundsOut[key] = { path: p, mime: s.mime };
    ops.push(uploadIfNew(BUCKET, p, s.blob));
  }
  await Promise.all(ops);

  const { error } = await supabase.from("viewers").upsert({
    id: v.id,
    owner_id: owner,
    public_id: publicId,
    slug: v.slug,
    name: v.name,
    accepts: v.accepts,
    controls: v.controls as never,
    resolution: v.resolution,
    background_path: bgPathFinal,
    background_type: v.backgroundType,
    token_path: tokPathFinal,
    token_type: v.tokenType,
    sounds: soundsOut as never,
    scene: {
      ...v.scene,
      respectMediaControls: v.respectMediaControls,
      deviceType: v.deviceType,
      hasScreen: v.hasScreen,
      audioDisplayMode: v.audioDisplayMode,
    } as never,
    is_public: true,
  });
  if (error) throw error;

  return { publicId };
}

export async function deleteViewer(id: string): Promise<void> {
  const owner = await requireOwnerId();
  // Best-effort cleanup of known asset paths.
  const { data: list } = await supabase.storage.from(BUCKET).list(`${owner}/${id}`, { limit: 100 });
  const paths: string[] = [];
  if (list) {
    for (const item of list) paths.push(`${owner}/${id}/${item.name}`);
  }
  const { data: soundsList } = await supabase.storage
    .from(BUCKET)
    .list(`${owner}/${id}/sounds`, { limit: 100 });
  if (soundsList) {
    for (const item of soundsList) paths.push(`${owner}/${id}/sounds/${item.name}`);
  }
  await removeFiles(BUCKET, paths);
  const { error } = await supabase.from("viewers").delete().eq("id", id);
  if (error) throw error;
}
