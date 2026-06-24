import type { Tape, TapePackage } from "./tape-types";

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

export async function exportTape(tape: Tape): Promise<Blob> {
  const pkg: TapePackage = {
    format: "rpg-vhs/1",
    meta: {
      id: tape.id,
      name: tape.name,
      description: tape.description,
      coverType: tape.coverType,
      videoType: tape.videoType,
      effects: tape.effects,
      autoplay: tape.autoplay,
      loop: tape.loop,
      createdAt: tape.createdAt,
      updatedAt: tape.updatedAt,
    },
    coverBase64: await blobToBase64(tape.cover),
    videoBase64: await blobToBase64(tape.video),
  };
  return new Blob([JSON.stringify(pkg)], { type: "application/x-rpg-vhs" });
}

export function downloadTape(tape: Tape, blob: Blob) {
  const slug = tape.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "fita";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}.vhs`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readTapeFile(file: File): Promise<Tape> {
  const text = await file.text();
  let pkg: TapePackage;
  try {
    pkg = JSON.parse(text);
  } catch {
    throw new Error("Arquivo .vhs inválido ou corrompido.");
  }
  if (pkg.format !== "rpg-vhs/1") throw new Error("Formato de fita desconhecido.");
  return {
    ...pkg.meta,
    cover: base64ToBlob(pkg.coverBase64, pkg.meta.coverType),
    video: base64ToBlob(pkg.videoBase64, pkg.meta.videoType),
  };
}
