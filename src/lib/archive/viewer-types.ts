import type { ArchiveKind } from "./types";

/** Controles que um visualizador pode oferecer ao jogador.
 *  Inclui controles de vídeo (timeline/frame) e de áudio (play/stop/vol). */
export const CONTROL_ACTIONS = [
  "pause",
  "ff",
  "rw",
  "frame",
  "timeline",
  "eject",
  "play",
  "stop",
  "volUp",
  "volDown",
] as const;
export type ControlAction = (typeof CONTROL_ACTIONS)[number];

export const CONTROL_LABELS: Record<ControlAction, string> = {
  pause: "Pausar",
  ff: "Avançar",
  rw: "Retroceder",
  frame: "Frame por Frame",
  timeline: "Linha do Tempo",
  eject: "Ejetar",
  play: "Play",
  stop: "Stop",
  volUp: "Volume +",
  volDown: "Volume −",
};

/** Quais controles fazem sentido para cada perfil de dispositivo. */
export const VIDEO_CONTROL_ACTIONS: ControlAction[] = [
  "pause", "ff", "rw", "frame", "timeline", "eject",
];
export const AUDIO_CONTROL_ACTIONS: ControlAction[] = [
  "play", "pause", "stop", "rw", "ff", "eject", "volUp", "volDown",
];

export const VIEWER_RESOLUTIONS = [
  "640x480",
  "1280x720",
  "1920x1080",
  "2560x1440",
  "3840x2160",
] as const;
export type ViewerResolution = (typeof VIEWER_RESOLUTIONS)[number];

/** Perfil de dispositivo. Define quais áreas e controles aparecem. */
export const DEVICE_TYPES = ["video", "audio", "mixed"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  video: "Vídeo",
  audio: "Áudio",
  mixed: "Misto",
};

/** O que aparece na "área de exibição" quando uma mídia de áudio toca
 *  (vale também para dispositivos sem tela: vira o painel principal). */
export const AUDIO_DISPLAY_MODES = [
  "none",
  "token",
  "playback_image",
  "info",
  "custom",
] as const;
export type AudioDisplayMode = (typeof AUDIO_DISPLAY_MODES)[number];

export const AUDIO_DISPLAY_LABELS: Record<AudioDisplayMode, string> = {
  none: "Nada",
  token: "Token da mídia",
  playback_image: "Imagem de reprodução",
  info: "Informações da mídia",
  custom: "Personalizado",
};

/** Item simples da cena do visualizador. Editor visual completo virá em etapa futura. */
export interface ViewerSceneItem {
  id: string;
  kind: "device" | "decoration";
  x: number; // 0..1
  y: number; // 0..1
  scale: number;
}

export interface CustomViewer {
  id: string;
  slug: string;
  name: string;
  deviceType: DeviceType;
  hasScreen: boolean;
  audioDisplayMode: AudioDisplayMode;
  /** QoL áudio: forma de onda animada durante a reprodução. */
  showWaveform: boolean;
  /** QoL áudio: permitir abrir transcrição/legenda da mídia. */
  allowSubtitles: boolean;
  /** QoL áudio: usar o token do próprio visualizador como imagem central
   *  do painel principal (rádios, walkmans, vitrolas). */
  useTokenAsDisplay: boolean;
  accepts: ArchiveKind[];
  controls: Record<ControlAction, boolean>;
  respectMediaControls: boolean;
  resolution: ViewerResolution;
  background: Blob | null;
  backgroundType: string | null;
  token: Blob | null;
  tokenType: string | null;
  sounds: Partial<Record<ControlAction | "insert", { blob: Blob; mime: string }>>;
  scene: { items: ViewerSceneItem[] };
  createdAt: number;
  updatedAt: number;
}

export interface CustomViewerMeta {
  id: string;
  slug: string;
  name: string;
  deviceType: DeviceType;
  hasScreen: boolean;
  accepts: ArchiveKind[];
  controls: Record<ControlAction, boolean>;
  resolution: ViewerResolution;
  createdAt: number;
  updatedAt: number;
}

export function newViewerId() {
  return crypto.randomUUID();
}

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `viewer-${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyControls(): Record<ControlAction, boolean> {
  const out = {} as Record<ControlAction, boolean>;
  for (const c of CONTROL_ACTIONS) out[c] = false;
  return out;
}

export function defaultControls(): Record<ControlAction, boolean> {
  return defaultControlsFor("video");
}

export function defaultControlsFor(deviceType: DeviceType): Record<ControlAction, boolean> {
  const base = emptyControls();
  if (deviceType === "video") {
    base.pause = true; base.ff = true; base.rw = true; base.eject = true;
  } else if (deviceType === "audio") {
    base.play = true; base.pause = true; base.stop = true;
    base.rw = true; base.ff = true; base.eject = true;
    base.volUp = true; base.volDown = true;
  } else {
    // mixed: tudo ligado
    for (const c of CONTROL_ACTIONS) base[c] = true;
  }
  return base;
}

export function defaultAcceptsFor(deviceType: DeviceType): ArchiveKind[] {
  if (deviceType === "audio") return ["audio"];
  if (deviceType === "mixed") return ["video", "audio", "image", "container"];
  return ["video"];
}

/** Defaults para a configuração "Funções Permitidas" da mídia — tudo liberado. */
export function defaultAllowedMediaControls(): Record<ControlAction, boolean> {
  const out = {} as Record<ControlAction, boolean>;
  for (const c of CONTROL_ACTIONS) out[c] = true;
  return out;
}

/**
 * Resolve quais controles ficam disponíveis ao jogador combinando os controles
 * que o visualizador oferece com as funções permitidas pela própria mídia.
 *
 * Regra: a mídia sempre tem prioridade. Se uma função estiver bloqueada nela,
 * permanece bloqueada mesmo que o visualizador suporte.
 */
export function resolveAvailableControls(
  viewerControls: Record<ControlAction, boolean>,
  mediaAllowed: Record<string, boolean> | undefined,
  respect: boolean,
): Record<ControlAction, boolean> {
  if (!respect || !mediaAllowed) return { ...viewerControls };
  const out = { ...viewerControls };
  for (const k of CONTROL_ACTIONS) {
    const mediaOk = mediaAllowed[k] ?? true;
    out[k] = viewerControls[k] && mediaOk;
  }
  return out;
}
