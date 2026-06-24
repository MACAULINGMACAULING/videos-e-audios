import type { CustomViewer } from "./viewer-types";

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

interface ViewerPackage {
  format: "archive-weaver-viewer/1";
  meta: Omit<CustomViewer, "background" | "token" | "sounds">;
  backgroundBase64: string | null;
  backgroundType: string | null;
  tokenBase64: string | null;
  tokenType: string | null;
  sounds: Record<string, { base64: string; mime: string }>;
}

export async function exportViewer(v: CustomViewer): Promise<Blob> {
  const { background, token, sounds, ...meta } = v;
  const soundsOut: Record<string, { base64: string; mime: string }> = {};
  for (const [k, s] of Object.entries(sounds)) {
    if (s) soundsOut[k] = { base64: await blobToBase64(s.blob), mime: s.mime };
  }
  const pkg: ViewerPackage = {
    format: "archive-weaver-viewer/1",
    meta,
    backgroundBase64: background ? await blobToBase64(background) : null,
    backgroundType: v.backgroundType,
    tokenBase64: token ? await blobToBase64(token) : null,
    tokenType: v.tokenType,
    sounds: soundsOut,
  };
  return new Blob([JSON.stringify(pkg)], { type: "application/x-archive-weaver-viewer" });
}

export function downloadViewer(v: CustomViewer, blob: Blob) {
  const slug = v.slug || "visualizador";
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = `${slug}.viewer`;
  document.body.appendChild(el);
  el.click();
  el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readViewerFile(file: File): Promise<CustomViewer> {
  const text = await file.text();
  const pkg = JSON.parse(text) as ViewerPackage;
  if (pkg.format !== "archive-weaver-viewer/1") throw new Error("Formato de visualizador desconhecido.");
  const sounds: CustomViewer["sounds"] = {};
  for (const [k, s] of Object.entries(pkg.sounds)) {
    sounds[k as keyof CustomViewer["sounds"]] = { blob: base64ToBlob(s.base64, s.mime), mime: s.mime };
  }
  return {
    ...pkg.meta,
    background: pkg.backgroundBase64 && pkg.backgroundType ? base64ToBlob(pkg.backgroundBase64, pkg.backgroundType) : null,
    backgroundType: pkg.backgroundType,
    token: pkg.tokenBase64 && pkg.tokenType ? base64ToBlob(pkg.tokenBase64, pkg.tokenType) : null,
    tokenType: pkg.tokenType,
    sounds,
  };
}
