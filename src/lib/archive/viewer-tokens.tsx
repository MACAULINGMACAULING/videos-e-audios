// Biblioteca de "tokens" (ícones) pré-feitos para visualizadores.
// O usuário pode escolher um destes OU fazer upload do próprio.
// Quando seleciona um preset, convertemos o SVG em Blob e salvamos
// como token comum — mantém o resto do sistema inalterado.

export interface TokenPreset {
  id: string;
  label: string;
  svg: string; // SVG string com viewBox 0 0 64 64
}

const STROKE = "#d4a04a"; // amber-signal aprox.
const FILL_DIM = "#1a140d";

function makeSvg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="${STROKE}" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><rect width="64" height="64" fill="${FILL_DIM}"/>${body}</svg>`;
}

export const TOKEN_PRESETS: TokenPreset[] = [
  {
    id: "tv",
    label: "TV",
    svg: makeSvg(
      `<rect x="8" y="14" width="48" height="34" rx="2"/><rect x="13" y="19" width="38" height="24"/><line x1="22" y1="54" x2="42" y2="54"/><line x1="28" y1="48" x2="28" y2="54"/><line x1="36" y1="48" x2="36" y2="54"/>`,
    ),
  },
  {
    id: "vcr",
    label: "Videocassete",
    svg: makeSvg(
      `<rect x="6" y="22" width="52" height="22" rx="1"/><rect x="10" y="28" width="20" height="8"/><circle cx="44" cy="32" r="2"/><circle cx="51" cy="32" r="2"/><line x1="10" y1="40" x2="14" y2="40"/>`,
    ),
  },
  {
    id: "monitor",
    label: "Monitor CRT",
    svg: makeSvg(
      `<rect x="6" y="10" width="52" height="36" rx="3"/><rect x="11" y="15" width="42" height="26" rx="2"/><rect x="26" y="50" width="12" height="4"/><line x1="20" y1="54" x2="44" y2="54"/>`,
    ),
  },
  {
    id: "radio",
    label: "Rádio",
    svg: makeSvg(
      `<rect x="6" y="14" width="52" height="36" rx="2"/><circle cx="20" cy="32" r="9"/><circle cx="20" cy="32" r="3"/><line x1="36" y1="22" x2="54" y2="22"/><line x1="36" y1="28" x2="54" y2="28"/><circle cx="42" cy="42" r="3"/><circle cx="52" cy="42" r="3"/>`,
    ),
  },
  {
    id: "laptop",
    label: "Notebook",
    svg: makeSvg(
      `<rect x="12" y="14" width="40" height="26" rx="1"/><rect x="16" y="18" width="32" height="18"/><line x1="6" y1="46" x2="58" y2="46"/><line x1="6" y1="46" x2="12" y2="40"/><line x1="58" y1="46" x2="52" y2="40"/>`,
    ),
  },
  {
    id: "projector",
    label: "Projetor",
    svg: makeSvg(
      `<rect x="6" y="22" width="40" height="22" rx="2"/><circle cx="16" cy="33" r="5"/><circle cx="16" cy="33" r="2"/><line x1="46" y1="28" x2="58" y2="22"/><line x1="46" y1="38" x2="58" y2="44"/><line x1="46" y1="33" x2="58" y2="33"/>`,
    ),
  },
  {
    id: "camera",
    label: "Câmera",
    svg: makeSvg(
      `<rect x="8" y="20" width="48" height="28" rx="2"/><rect x="20" y="14" width="14" height="6"/><circle cx="28" cy="34" r="8"/><circle cx="28" cy="34" r="4"/><circle cx="46" cy="26" r="1.5" fill="${STROKE}"/>`,
    ),
  },
  {
    id: "phone",
    label: "Telefone",
    svg: makeSvg(
      `<rect x="20" y="6" width="24" height="52" rx="3"/><rect x="23" y="11" width="18" height="32"/><circle cx="32" cy="51" r="2"/>`,
    ),
  },
];

export function getTokenPreset(id: string): TokenPreset | undefined {
  return TOKEN_PRESETS.find((p) => p.id === id);
}

/** Converte um preset em Blob SVG para salvar como token comum. */
export function presetToBlob(id: string): { blob: Blob; mime: string } | null {
  const p = getTokenPreset(id);
  if (!p) return null;
  return { blob: new Blob([p.svg], { type: "image/svg+xml" }), mime: "image/svg+xml" };
}
