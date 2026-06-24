// Cadeia de prioridade de áudio do Archive WEAVER:
//
//   MÍDIA (custom)  →  VISUALIZADOR (custom)  →  FORMATO (padrão)  →  SISTEMA
//
// Quem definir primeiro, ganha. Permite que uma fita amaldiçoada substitua
// sons específicos sem precisar de um visualizador inteiro só pra ela.

import type { MediaFormat } from "./types";
import { playMediaSound, type MediaSoundSlot } from "./media-sounds";
import { playClick, playEject, playInsert } from "@/lib/vhs-audio";

/** Chaves de som suportadas tanto na mídia quanto no visualizador. */
export const SOUND_KEYS = [
  "insert",
  "eject",
  "pause",
  "ff",
  "rw",
  "frame",
  "play",
  "stop",
  "volUp",
  "volDown",
  "timeline",
] as const;
export type SoundKey = (typeof SOUND_KEYS)[number];

export const SOUND_LABELS: Record<SoundKey, string> = {
  insert: "Inserir",
  eject: "Ejetar",
  pause: "Pausar",
  ff: "Avançar",
  rw: "Retroceder",
  frame: "Frame por Frame",
  play: "Reprodução Iniciada",
  stop: "Reprodução Encerrada",
  volUp: "Volume +",
  volDown: "Volume −",
  timeline: "Buscar (Timeline)",
};

type BlobSound = { blob: Blob; mime: string };
type SoundMap = Partial<Record<string, BlobSound | undefined>>;

export interface SoundChainSources {
  /** Sons personalizados da mídia (prioridade máxima). */
  mediaCustom?: SoundMap;
  /** Sons do visualizador. */
  viewerCustom?: SoundMap;
  /** Formato físico da mídia, para sons padrão registrados. */
  mediaFormat?: MediaFormat | null;
}

// Reaproveita URLs de blob para evitar vazamentos a cada clique.
const blobUrlCache = new WeakMap<Blob, string>();
function urlFor(b: Blob): string {
  let u = blobUrlCache.get(b);
  if (!u) {
    u = URL.createObjectURL(b);
    blobUrlCache.set(b, u);
  }
  return u;
}

function playBlob(b: Blob): boolean {
  try {
    const audio = new Audio(urlFor(b));
    void audio.play().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function defaultSlot(k: SoundKey): MediaSoundSlot {
  switch (k) {
    case "insert": return "insert";
    case "eject":  return "eject";
    case "ff":     return "fastForward";
    case "rw":     return "rewind";
    default:       return "button";
  }
}

/** Toca o som mais prioritário disponível para a ação. */
export function playChainedSound(key: SoundKey, src: SoundChainSources): void {
  // 1) Mídia — sons personalizados do arquivo
  const mc = src.mediaCustom?.[key];
  if (mc?.blob && playBlob(mc.blob)) return;

  // 2) Visualizador — sons personalizados do dispositivo
  const vc = src.viewerCustom?.[key];
  if (vc?.blob && playBlob(vc.blob)) return;

  // 3) Formato — som padrão registrado para o tipo físico (VHS/DVD/...)
  if (src.mediaFormat && playMediaSound(src.mediaFormat, defaultSlot(key))) return;

  // 4) Sistema — fallback sintetizado
  if (key === "insert") playInsert();
  else if (key === "eject") playEject();
  else playClick();
}
