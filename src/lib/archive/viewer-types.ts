import type { ArchiveKind } from "./types";

/** Controles que um visualizador pode oferecer ao jogador. */
export const CONTROL_ACTIONS = [
  "pause",
  "ff",
  "rw",
  "frame",
  "timeline",
  "eject",
] as const;
export type ControlAction = (typeof CONTROL_ACTIONS)[number];

export const CONTROL_LABELS: Record<ControlAction, string> = {
  pause: "Pausar",
  ff: "Avançar",
  rw: "Retroceder",
  frame: "Frame por Frame",
  timeline: "Linha do Tempo",
  eject: "Ejetar",
};

export const VIEWER_RESOLUTIONS = [
  "640x480",
  "1280x720",
  "1920x1080",
  "2560x1440",
  "3840x2160",
] as const;
export type ViewerResolution = (typeof VIEWER_RESOLUTIONS)[number];

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
  accepts: ArchiveKind[];
  controls: Record<ControlAction, boolean>;
  resolution: ViewerResolution;
  background: Blob | null;
  backgroundType: string | null;
  token: Blob | null;
  tokenType: string | null;
  /** Sons por ação — sobrescrevem o conjunto do formato da mídia. */
  sounds: Partial<Record<ControlAction | "insert", { blob: Blob; mime: string }>>;
  scene: { items: ViewerSceneItem[] };
  createdAt: number;
  updatedAt: number;
}

export interface CustomViewerMeta {
  id: string;
  slug: string;
  name: string;
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

export function defaultControls(): Record<ControlAction, boolean> {
  return { pause: true, ff: true, rw: true, frame: false, timeline: false, eject: true };
}
