import type { ArchiveFile, VideoArchive } from "./types";

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

interface ArchivePackage {
  format: "archive-weaver/1";
  meta: Omit<ArchiveFile, "token" | "payload">;
  tokenBase64: string;
  payload: { kind: "video"; videoBase64: string; videoType: string; resolution: string; effects: VideoArchive["payload"]["effects"] };
}

export async function exportArchive(a: ArchiveFile): Promise<Blob> {
  const { token, payload, ...meta } = a;
  const pkg: ArchivePackage = {
    format: "archive-weaver/1",
    meta,
    tokenBase64: await blobToBase64(token),
    payload: {
      kind: "video",
      videoBase64: await blobToBase64(payload.video),
      videoType: payload.videoType,
      resolution: payload.resolution,
      effects: payload.effects,
    },
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
  if (pkg.payload.kind !== "video") {
    throw new Error("Este visualizador só aceita arquivos de vídeo.");
  }
  return {
    ...pkg.meta,
    kind: "video",
    token: base64ToBlob(pkg.tokenBase64, pkg.meta.tokenType),
    payload: {
      video: base64ToBlob(pkg.payload.videoBase64, pkg.payload.videoType),
      videoType: pkg.payload.videoType,
      resolution: pkg.payload.resolution as VideoArchive["payload"]["resolution"],
      effects: pkg.payload.effects,
    },
  } as ArchiveFile;
}