import type { VhsEffects } from "@/lib/tape-types";

export type ArchiveKind = "video" | "audio" | "image" | "container";

export type ViewerId =
  | "tv-vhs"
  | "dvd-player"
  | "monitor-crt"
  | "computador"
  | "radio"
  | "cassette-recorder"
  | "cd-player"
  | "vinyl-player";

export type MediaFormat =
  | { kind: "vhs" }
  | { kind: "dvd" }
  | { kind: "cassette" }
  | { kind: "cd" }
  | { kind: "vinyl" }
  | { kind: "digital" }
  | { kind: "other"; label: string };

export const RESOLUTIONS = [
  "640x480",
  "1280x720",
  "1920x1080",
  "2560x1440",
  "3840x2160",
] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export interface BaseArchive {
  id: string;
  kind: ArchiveKind;
  name: string;
  description: string;
  token: Blob;
  tokenType: string;
  format: MediaFormat;
  compatibleViewers: ViewerId[];
  autoplay: boolean;
  loop: boolean;
  /** Funções permitidas pela mídia. Quando o visualizador respeita restrições da mídia,
   *  apenas controles habilitados aqui ficam disponíveis. Chaves: pause/ff/rw/frame/timeline/eject. */
  allowedControls?: Record<string, boolean>;
  /** Sons personalizados da mídia. Prioridade máxima na cadeia de áudio. */
  customSounds?: Record<string, { blob: Blob; mime: string }>;
  createdAt: number;
  updatedAt: number;
}

export interface VideoPayload {
  video: Blob;
  videoType: string;
  resolution: Resolution;
  /** Mantido para o visualizador atual; o criador não edita aqui. */
  effects: VhsEffects;
}

export interface VideoArchive extends BaseArchive {
  kind: "video";
  payload: VideoPayload;
}

export interface AudioPayload {
  audio: Blob;
  audioType: string;
  /** Imagem opcional exibida no visualizador enquanto o áudio toca. */
  playbackImage?: Blob;
  playbackImageType?: string;
}

export interface AudioArchive extends BaseArchive {
  kind: "audio";
  payload: AudioPayload;
}

/** União expandirá conforme novos tipos forem implementados. */
export type ArchiveFile = VideoArchive | AudioArchive;

export interface ArchiveMeta {
  id: string;
  kind: ArchiveKind;
  name: string;
  description: string;
  tokenType: string;
  format: MediaFormat;
  compatibleViewers: ViewerId[];
  autoplay: boolean;
  loop: boolean;
  allowedControls?: Record<string, boolean>;
  createdAt: number;
  updatedAt: number;
  /** Resumo do payload para listagens. */
  summary?: string;
}

export function formatLabel(f: MediaFormat): string {
  switch (f.kind) {
    case "vhs": return "VHS";
    case "dvd": return "DVD";
    case "cassette": return "Cassete";
    case "cd": return "CD";
    case "vinyl": return "Vinil";
    case "digital": return "Digital";
    case "other": return f.label || "Formato Próprio";
  }
}

export function newArchiveId() {
  return crypto.randomUUID();
}
