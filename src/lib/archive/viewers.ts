import type { ArchiveFile, ArchiveKind, MediaFormat, ViewerId } from "./types";

export interface ViewerDef {
  id: ViewerId;
  label: string;
  description: string;
  /** Tipos de arquivo que o dispositivo aceita. */
  accepts: ArchiveKind[];
  /** Formato físico ao qual o dispositivo "pertence" (usado para sugestão). */
  preferredFormat?: MediaFormat["kind"];
}

export const VIEWERS: ViewerDef[] = [
  {
    id: "tv-vhs",
    label: "TV VHS",
    description: "Televisor com videocassete. Aceita fitas VHS.",
    accepts: ["video"],
    preferredFormat: "vhs",
  },
  {
    id: "dvd-player",
    label: "DVD Player",
    description: "Reprodutor de discos. Aceita DVDs.",
    accepts: ["video"],
    preferredFormat: "dvd",
  },
  {
    id: "monitor-crt",
    label: "Monitor CRT",
    description: "Tubo catódico. Aceita vídeo e imagem estática.",
    accepts: ["video", "image"],
  },
  {
    id: "computador",
    label: "Computador",
    description: "Estação multipropósito. Aceita todos os formatos.",
    accepts: ["video", "audio", "image", "container"],
  },
];

export function getViewer(id: ViewerId): ViewerDef | undefined {
  return VIEWERS.find((v) => v.id === id);
}

export function canPlay(archive: ArchiveFile, viewerId: ViewerId): boolean {
  if (!archive.compatibleViewers.includes(viewerId)) return false;
  const viewer = getViewer(viewerId);
  if (!viewer) return false;
  return viewer.accepts.includes(archive.kind);
}

/** Visualizadores sugeridos para um dado formato físico. */
export function suggestedViewersForFormat(format: MediaFormat, kind: ArchiveKind): ViewerId[] {
  const fkind = format.kind;
  return VIEWERS.filter((v) => v.accepts.includes(kind))
    .filter((v) => !v.preferredFormat || v.preferredFormat === fkind || fkind === "other")
    .map((v) => v.id);
}