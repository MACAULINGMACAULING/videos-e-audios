import type { ArchiveFile, AudioArchive, VideoArchive } from "./types";

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBlob(b64: string, type: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

type VideoPayloadPkg = {
  kind: "video";
  videoBase64: string;
  videoType: string;
  resolution: string;
  effects: VideoArchive["payload"]["effects"];
};

type AudioPayloadPkg = {
  kind: "audio";
  audioBase64: string;
  audioType: string;
  playbackImageBase64?: string;
  playbackImageType?: string;
  transcript?: string;
};

interface ArchivePackage {
  format: "archive-weaver/1";
  meta: Omit<ArchiveFile, "token" | "payload" | "customSounds">;
  tokenBase64: string;
  customSounds?: Record<string, { base64: string; mime: string }>;
  payload: VideoPayloadPkg | AudioPayloadPkg;
}

export async function exportArchive(a: ArchiveFile): Promise<Blob> {
  const { token, payload, customSounds, ...meta } = a;
  const csOut: Record<string, { base64: string; mime: string }> = {};
  if (customSounds) {
    for (const [k, s] of Object.entries(customSounds)) {
      if (!s) continue;
      csOut[k] = { base64: await blobToBase64(s.blob), mime: s.mime };
    }
  }

  let payloadPkg: VideoPayloadPkg | AudioPayloadPkg;
  if (a.kind === "video") {
    payloadPkg = {
      kind: "video",
      videoBase64: await blobToBase64(a.payload.video),
      videoType: a.payload.videoType,
      resolution: a.payload.resolution,
      effects: a.payload.effects,
    };
  } else {
    payloadPkg = {
      kind: "audio",
      audioBase64: await blobToBase64(a.payload.audio),
      audioType: a.payload.audioType,
      playbackImageBase64: a.payload.playbackImage
        ? await blobToBase64(a.payload.playbackImage)
        : undefined,
      playbackImageType: a.payload.playbackImageType,
      transcript: a.payload.transcript,
    };
  }

  const pkg: ArchivePackage = {
    format: "archive-weaver/1",
    meta,
    tokenBase64: await blobToBase64(token),
    customSounds: Object.keys(csOut).length ? csOut : undefined,
    payload: payloadPkg,
  };
  return new Blob([JSON.stringify(pkg)], { type: "application/x-archive-weaver" });
}

export function downloadArchive(a: ArchiveFile, blob: Blob) {
  const slug =
    a.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") ||
    "arquivo";
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = `${slug}.archive`;
  document.body.appendChild(el);
  el.click();
  el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readArchiveFile(file: File): Promise<ArchiveFile> {
  const text = await file.text();
  let pkg: ArchivePackage;
  try {
    pkg = JSON.parse(text);
  } catch {
    throw new Error("Arquivo inválido ou corrompido.");
  }
  if (pkg.format !== "archive-weaver/1") {
    throw new Error("Formato de arquivo desconhecido.");
  }

  const customSounds: Record<string, { blob: Blob; mime: string }> = {};
  if (pkg.customSounds) {
    for (const [k, s] of Object.entries(pkg.customSounds)) {
      customSounds[k] = { blob: base64ToBlob(s.base64, s.mime), mime: s.mime };
    }
  }
  const cs = Object.keys(customSounds).length ? customSounds : undefined;
  const token = base64ToBlob(pkg.tokenBase64, pkg.meta.tokenType);

  if (pkg.payload.kind === "video") {
    const v: VideoArchive = {
      ...(pkg.meta as Omit<VideoArchive, "token" | "payload" | "customSounds">),
      kind: "video",
      token,
      customSounds: cs,
      payload: {
        video: base64ToBlob(pkg.payload.videoBase64, pkg.payload.videoType),
        videoType: pkg.payload.videoType,
        resolution: pkg.payload.resolution as VideoArchive["payload"]["resolution"],
        effects: pkg.payload.effects,
      },
    };
    return v;
  }
  if (pkg.payload.kind === "audio") {
    const a: AudioArchive = {
      ...(pkg.meta as Omit<AudioArchive, "token" | "payload" | "customSounds">),
      kind: "audio",
      token,
      customSounds: cs,
      payload: {
        audio: base64ToBlob(pkg.payload.audioBase64, pkg.payload.audioType),
        audioType: pkg.payload.audioType,
        playbackImage: pkg.payload.playbackImageBase64
          ? base64ToBlob(pkg.payload.playbackImageBase64, pkg.payload.playbackImageType ?? "image/png")
          : undefined,
        playbackImageType: pkg.payload.playbackImageType,
        transcript: pkg.payload.transcript,
      },
    };
    return a;
  }
  throw new Error("Tipo de payload desconhecido.");
}
