import { supabase } from "@/integrations/supabase/client";
import type {
  ArchiveFile,
  ArchiveMeta,
  AudioArchive,
  MediaFormat,
  Resolution,
  VideoArchive,
  ViewerId,
} from "./types";
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
function playbackImagePath(owner: string, id: string) { return `${owner}/${id}/playback-image`; }
function soundPath(owner: string, id: string, key: string) {
  return `${owner}/${id}/sounds/${key}`;
}

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
  payload_extra: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function rowToMeta(r: ArchiveRow): ArchiveMeta {
  const extra = (r.payload_extra ?? {}) as { allowedControls?: Record<string, boolean> };
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
    allowedControls: extra.allowedControls,
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

async function loadCustomSounds(
  extra: { customSounds?: Record<string, { path: string; mime: string }> },
): Promise<Record<string, { blob: Blob; mime: string }> | undefined> {
  if (!extra.customSounds) return undefined;
  const out: Record<string, { blob: Blob; mime: string }> = {};
  await Promise.all(
    Object.entries(extra.customSounds).map(async ([k, s]) => {
      try {
        out[k] = { blob: await downloadBlob(BUCKET, s.path), mime: s.mime };
      } catch {
        // ignora sons faltantes
      }
    }),
  );
  return Object.keys(out).length ? out : undefined;
}

export async function getArchive(id: string): Promise<ArchiveFile | undefined> {
  const { data, error } = await supabase.from("archives").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const r = data as unknown as ArchiveRow;
  if (!r.token_path || !r.payload_path) return undefined;

  if (r.kind === "video") {
    const extra = (r.payload_extra ?? {}) as {
      resolution?: Resolution;
      effects?: VhsEffects;
      allowedControls?: Record<string, boolean>;
      customSounds?: Record<string, { path: string; mime: string }>;
    };
    const [token, video, customSounds] = await Promise.all([
      downloadBlob(BUCKET, r.token_path),
      downloadBlob(BUCKET, r.payload_path),
      loadCustomSounds(extra),
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
      allowedControls: extra.allowedControls,
      customSounds,
      createdAt: new Date(r.created_at).getTime(),
      updatedAt: new Date(r.updated_at).getTime(),
      payload: {
        video,
        videoType: r.payload_mime ?? "video/mp4",
        resolution: extra.resolution ?? "1280x720",
        effects: extra.effects ?? DEFAULT_EFFECTS,
      },
    };
    return archive;
  }

  if (r.kind === "audio") {
    const extra = (r.payload_extra ?? {}) as {
      allowedControls?: Record<string, boolean>;
      customSounds?: Record<string, { path: string; mime: string }>;
      playbackImagePath?: string;
      playbackImageType?: string;
    };
    const [token, audio, customSounds, playbackImage] = await Promise.all([
      downloadBlob(BUCKET, r.token_path),
      downloadBlob(BUCKET, r.payload_path),
      loadCustomSounds(extra),
      extra.playbackImagePath
        ? downloadBlob(BUCKET, extra.playbackImagePath).catch(() => undefined)
        : Promise.resolve(undefined),
    ]);
    const archive: AudioArchive = {
      id: r.id,
      kind: "audio",
      name: r.name,
      description: r.description,
      token,
      tokenType: r.token_type ?? "image/png",
      format: r.format,
      compatibleViewers: r.compatible_viewers as ViewerId[],
      autoplay: r.autoplay,
      loop: r.loop,
      allowedControls: extra.allowedControls,
      customSounds,
      createdAt: new Date(r.created_at).getTime(),
      updatedAt: new Date(r.updated_at).getTime(),
      payload: {
        audio,
        audioType: r.payload_mime ?? "audio/mpeg",
        playbackImage: playbackImage ?? undefined,
        playbackImageType: playbackImage ? extra.playbackImageType : undefined,
      },
    };
    return archive;
  }

  return undefined;
}

export async function saveArchive(a: ArchiveFile): Promise<void> {
  const owner = await requireOwnerId();
  const tPath = tokenPath(owner, a.id);
  const pPath = payloadPath(owner, a.id);

  const ops: Promise<unknown>[] = [
    uploadIfNew(BUCKET, tPath, a.token),
  ];

  let payloadMime: string;
  const payloadExtra: Record<string, unknown> = {
    allowedControls: a.allowedControls ?? null,
  };

  if (a.kind === "video") {
    ops.push(uploadIfNew(BUCKET, pPath, a.payload.video));
    payloadMime = a.payload.videoType;
    payloadExtra.resolution = a.payload.resolution;
    payloadExtra.effects = a.payload.effects as unknown as Record<string, number>;
  } else if (a.kind === "audio") {
    ops.push(uploadIfNew(BUCKET, pPath, a.payload.audio));
    payloadMime = a.payload.audioType;
    if (a.payload.playbackImage) {
      const ipath = playbackImagePath(owner, a.id);
      ops.push(uploadIfNew(BUCKET, ipath, a.payload.playbackImage));
      payloadExtra.playbackImagePath = ipath;
      payloadExtra.playbackImageType = a.payload.playbackImageType ?? "image/png";
    } else {
      payloadExtra.playbackImagePath = null;
      payloadExtra.playbackImageType = null;
    }
  } else {
    throw new Error("Tipo de arquivo não suportado.");
  }

  const customSoundsOut: Record<string, { path: string; mime: string }> = {};
  if (a.customSounds) {
    for (const [k, s] of Object.entries(a.customSounds)) {
      if (!s) continue;
      const sp = soundPath(owner, a.id, k);
      customSoundsOut[k] = { path: sp, mime: s.mime };
      ops.push(uploadIfNew(BUCKET, sp, s.blob));
    }
  }
  payloadExtra.customSounds = Object.keys(customSoundsOut).length ? customSoundsOut : null;

  await Promise.all(ops);

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
    payload_mime: payloadMime,
    payload_extra: payloadExtra as never,
  });
  if (error) throw error;
}

export async function deleteArchive(id: string): Promise<void> {
  const owner = await requireOwnerId();
  const paths: string[] = [
    tokenPath(owner, id),
    payloadPath(owner, id),
    playbackImagePath(owner, id),
  ];
  const { data: soundsList } = await supabase.storage
    .from(BUCKET)
    .list(`${owner}/${id}/sounds`, { limit: 100 });
  if (soundsList) {
    for (const item of soundsList) paths.push(`${owner}/${id}/sounds/${item.name}`);
  }
  await removeFiles(BUCKET, paths);
  const { error } = await supabase.from("archives").delete().eq("id", id);
  if (error) throw error;
}
