export interface VhsEffects {
  noise: number;        // 0-100
  scanlines: number;    // 0-100
  tracking: number;     // 0-100
  ghosting: number;     // 0-100
  chromatic: number;    // 0-100 (horizontal distortion / chromatic aberration)
  signalLoss: number;   // 0-100
  tapeDamage: number;   // 0-100
}

export const DEFAULT_EFFECTS: VhsEffects = {
  noise: 35,
  scanlines: 55,
  tracking: 20,
  ghosting: 25,
  chromatic: 20,
  signalLoss: 10,
  tapeDamage: 15,
};

export interface TapeMeta {
  id: string;
  name: string;
  description: string;
  coverType: string;   // mime
  videoType: string;   // mime
  effects: VhsEffects;
  autoplay: boolean;
  loop: boolean;
  /** Funções permitidas pela própria mídia. Chaves: pause/ff/rw/frame/timeline/eject. */
  allowedControls?: Record<string, boolean>;
  createdAt: number;
  updatedAt: number;
}

export interface Tape extends TapeMeta {
  cover: Blob;
  video: Blob;
  /** Sons personalizados carregados a partir do arquivo. */
  customSounds?: Record<string, { blob: Blob; mime: string }>;
}

export interface TapePackage {
  format: "rpg-vhs/1";
  meta: TapeMeta;
  coverBase64: string;
  videoBase64: string;
}
