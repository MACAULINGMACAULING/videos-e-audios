import type { ArchiveKind } from "./types";

export interface ArchiveTypeDef {
  kind: ArchiveKind;
  code: string;
  label: string;
  description: string;
  status: "ready" | "wip";
  /** Para tipos "ready" — rota do criador. */
  creatorRoute?: string;
  /** Glyph noir simples; evitamos depender de ícones para novos tipos. */
  glyph: string;
}

export const ARCHIVE_TYPES: ArchiveTypeDef[] = [
  {
    kind: "video",
    code: "01",
    label: "Vídeo",
    description: "Filmagem, registro, entrevista. Mídia visual com som.",
    status: "ready",
    creatorRoute: "/criador/video",
    glyph: "▶",
  },
  {
    kind: "audio",
    code: "02",
    label: "Áudio",
    description: "Gravações, escutas, transmissões de rádio.",
    status: "wip",
    glyph: "♪",
  },
  {
    kind: "image",
    code: "03",
    label: "Imagem",
    description: "Fotografia, documento digitalizado, mapa.",
    status: "wip",
    glyph: "▣",
  },
  {
    kind: "container",
    code: "04",
    label: "Container",
    description: "Conjunto de evidências agrupadas em um único arquivo.",
    status: "wip",
    glyph: "▤",
  },
];

export function getArchiveType(kind: ArchiveKind): ArchiveTypeDef | undefined {
  return ARCHIVE_TYPES.find((t) => t.kind === kind);
}