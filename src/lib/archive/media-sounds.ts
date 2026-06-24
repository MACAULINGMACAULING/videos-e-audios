// Sons associados a cada tipo de mídia física (VHS, DVD, CD, Vinil, etc.).
// A arquitetura é desacoplada do sistema global: cada formato declara seu
// próprio conjunto de sons. Novos formatos só precisam registrar uma entrada
// — visualizadores apenas pedem por slots nomeados.

import type { MediaFormat } from "./types";
import cassetteInsert from "@/assets/sounds/cassette_insert.mp3.asset.json";
import cassetteOut from "@/assets/sounds/cassette_out.mp3.asset.json";
import buttonClick from "@/assets/sounds/button.mp3.asset.json";

/**
 * Slots sonoros reconhecidos. Não obrigatórios — cada formato preenche
 * apenas o que faz sentido para sua identidade física.
 *
 *  - insert:        mídia entrando no aparelho
 *  - eject:         mídia sendo removida / ejetada
 *  - button:        clique genérico em controles (play/pause/stop/etc.)
 *  - trayOpen:      bandeja abrindo (DVD/CD)
 *  - trayClose:     bandeja fechando (DVD/CD)
 *  - fastForward:   avanço rápido sustentado
 *  - rewind:        retrocesso sustentado
 *  - needleDrop:    agulha tocando o disco (vinil)
 *  - trackChange:   troca de faixa (CD/vinil)
 */
export type MediaSoundSlot =
  | "insert"
  | "eject"
  | "button"
  | "trayOpen"
  | "trayClose"
  | "fastForward"
  | "rewind"
  | "needleDrop"
  | "trackChange";

export interface MediaSoundSet {
  /** Volume base aplicado a todos os sons deste formato (0..1). */
  volume?: number;
  sounds: Partial<Record<MediaSoundSlot, string>>;
}

/**
 * Chave de identidade do formato. Usa o `kind` de `MediaFormat` e — para
 * formatos "Outro" — o label livre do usuário, permitindo que mídias
 * personalizadas tragam seu próprio conjunto sonoro no futuro.
 */
export type MediaFormatKey = string;

export function formatKey(format: MediaFormat): MediaFormatKey {
  if (format.kind === "other") return `other:${format.label.trim().toLowerCase()}`;
  return format.kind;
}

const REGISTRY = new Map<MediaFormatKey, MediaSoundSet>();

/** Registra (ou substitui) o conjunto sonoro de um formato. */
export function registerMediaSounds(key: MediaFormatKey, set: MediaSoundSet) {
  REGISTRY.set(key, set);
}

export function getMediaSounds(format: MediaFormat): MediaSoundSet | undefined {
  return REGISTRY.get(formatKey(format));
}

// --- Registros padrão -------------------------------------------------------

registerMediaSounds("vhs", {
  volume: 0.9,
  sounds: {
    insert: cassetteInsert.url,
    eject: cassetteOut.url,
    button: buttonClick.url,
  },
});

// DVD / outros formatos ficarão registrados conforme assets cheguem.
// Exemplo (deixe comentado até termos os áudios):
// registerMediaSounds("dvd", { sounds: { trayOpen: ..., trayClose: ..., button: ... } });

// --- Reprodução -------------------------------------------------------------

// Cache de Audio elements para evitar recriação a cada clique e permitir
// reprodução sobreposta (clone na hora do play).
const audioCache = new Map<string, HTMLAudioElement>();

function getAudio(url: string): HTMLAudioElement {
  let a = audioCache.get(url);
  if (!a) {
    a = new Audio(url);
    a.preload = "auto";
    audioCache.set(url, a);
  }
  return a;
}

/**
 * Toca o slot solicitado para o formato dado. Retorna `true` se um som foi
 * disparado, `false` caso o formato não declare aquele slot (o chamador
 * pode então cair em um fallback sintetizado, se desejar).
 */
export function playMediaSound(
  format: MediaFormat | null | undefined,
  slot: MediaSoundSlot,
): boolean {
  if (!format) return false;
  const set = getMediaSounds(format);
  const url = set?.sounds[slot];
  if (!url) return false;
  try {
    // Clona para permitir sobreposição (clique rápido em sequência).
    const base = getAudio(url);
    const node = base.cloneNode(true) as HTMLAudioElement;
    node.volume = set.volume ?? 1;
    void node.play().catch(() => {});
  } catch {
    return false;
  }
  return true;
}

/** Pré-carrega todos os sons de um formato (chamar ao montar o visualizador). */
export function preloadMediaSounds(format: MediaFormat | null | undefined) {
  if (!format) return;
  const set = getMediaSounds(format);
  if (!set) return;
  for (const url of Object.values(set.sounds)) {
    if (url) getAudio(url);
  }
}
