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
    id: "radio",
    label: "Rádio",
    description: "Receptor de rádio. Aceita gravações e transmissões.",
    accepts: ["audio"],
  },
  {
    id: "cassette-recorder",
    label: "Gravador Cassete",
    description: "Aparelho de fita cassete. Aceita gravações magnéticas.",
    accepts: ["audio"],
    preferredFormat: "cassette",
  },
  {
    id: "cd-player",
    label: "CD Player",
    description: "Reprodutor de CDs de áudio.",
    accepts: ["audio"],
    preferredFormat: "cd",
  },
  {
    id: "vinyl-player",
    label: "Vitrola",
    description: "Toca-discos de vinil.",
    accepts: ["audio"],
    preferredFormat: "vinyl",
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
  const wildcard = fkind === "other" || fkind === "digital";
  return VIEWERS.filter((v) => v.accepts.includes(kind))
    .filter((v) => !v.preferredFormat || v.preferredFormat === fkind || wildcard)
    .map((v) => v.id);
}
