import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { NoirShell } from "@/components/noir-shell";
import type { ArchiveKind } from "@/lib/archive/types";
import {
  AUDIO_CONTROL_ACTIONS,
  AUDIO_DISPLAY_LABELS,
  AUDIO_DISPLAY_MODES,
  CONTROL_LABELS,
  DEVICE_TYPES,
  DEVICE_TYPE_LABELS,
  VIDEO_CONTROL_ACTIONS,
  VIEWER_RESOLUTIONS,
  defaultAcceptsFor,
  defaultControlsFor,
  emptyControls,
  newViewerId,
  slugify,
  type AudioDisplayMode,
  type ControlAction,
  type CustomViewer,
  type DeviceType,
  type ViewerResolution,
} from "@/lib/archive/viewer-types";
import { getViewer, getViewerPublicId, saveViewer } from "@/lib/archive/viewer-db";
import { downloadViewer, exportViewer } from "@/lib/archive/viewer-export";
import { TOKEN_PRESETS, presetToBlob } from "@/lib/archive/viewer-tokens";

interface SearchParams {
  id?: string;
}

export const Route = createFileRoute("/_authenticated/criador/visualizador")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Criador de Visualizador — Archive WEAVER" },
      { name: "description", content: "Crie dispositivos de reprodução: TVs, rádios, walkmans, vitrolas." },
    ],
  }),
  component: ViewerCreator,
});

const KIND_OPTIONS: { kind: ArchiveKind; label: string }[] = [
  { kind: "video", label: "Vídeo" },
  { kind: "audio", label: "Áudio" },
  { kind: "image", label: "Imagem" },
  { kind: "container", label: "Arquivo (Container)" },
];

const DEVICE_HINTS: Record<DeviceType, string> = {
  video: "TVs, monitores, projetores. Possuem área principal de vídeo.",
  audio: "Rádios, gravadores, walkmans, CD players, vitrolas. Sem tela — foco em controles e info da mídia.",
  mixed: "Computadores, sistemas multimídia, dispositivos customizados. Abrem qualquer formato.",
};

type SoundKey = ControlAction | "insert";

function ViewerCreator() {
  const { id } = useSearch({ from: "/_authenticated/criador/visualizador" });
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [deviceType, setDeviceType] = useState<DeviceType>("video");
  const [hasScreen, setHasScreen] = useState(true);
  const [audioDisplayMode, setAudioDisplayMode] = useState<AudioDisplayMode>("token");
  const [showWaveform, setShowWaveform] = useState(false);
  const [allowSubtitles, setAllowSubtitles] = useState(false);
  const [useTokenAsDisplay, setUseTokenAsDisplay] = useState(false);
  const [accepts, setAccepts] = useState<ArchiveKind[]>(["video"]);
  const [controls, setControls] = useState(defaultControlsFor("video"));
  const [respectMediaControls, setRespectMediaControls] = useState(true);
  const [resolution, setResolution] = useState<ViewerResolution>("1280x720");
  const [background, setBackground] = useState<{ blob: Blob; mime: string } | null>(null);
  const [token, setToken] = useState<{ blob: Blob; mime: string } | null>(null);
  const [sounds, setSounds] = useState<Partial<Record<SoundKey, { blob: Blob; mime: string }>>>({});
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const userTouchedRef = useRef({ accepts: false, controls: false, screen: false });

  // Load existing
  useEffect(() => {
    if (!id) return;
    void getViewer(id).then((v) => {
      if (!v) return;
      setLoadedId(v.id);
      setName(v.name);
      setDeviceType(v.deviceType);
      setHasScreen(v.hasScreen);
      setAudioDisplayMode(v.audioDisplayMode);
      setShowWaveform(v.showWaveform ?? false);
      setAllowSubtitles(v.allowSubtitles ?? false);
      setUseTokenAsDisplay(v.useTokenAsDisplay ?? false);
      setAccepts(v.accepts);
      setControls({ ...emptyControls(), ...v.controls });
      setRespectMediaControls(v.respectMediaControls ?? true);
      setResolution(v.resolution);
      if (v.background && v.backgroundType) setBackground({ blob: v.background, mime: v.backgroundType });
      if (v.token && v.tokenType) setToken({ blob: v.token, mime: v.tokenType });
      setSounds(v.sounds ?? {});
      userTouchedRef.current = { accepts: true, controls: true, screen: true };
    });
    void getViewerPublicId(id).then((p) => { if (p) setPublicId(p); });
  }, [id]);

  // When deviceType changes (and user hasn't manually overridden), realign defaults.
  function selectDeviceType(t: DeviceType) {
    setDeviceType(t);
    if (!userTouchedRef.current.accepts) setAccepts(defaultAcceptsFor(t));
    if (!userTouchedRef.current.controls) setControls(defaultControlsFor(t));
    if (!userTouchedRef.current.screen) setHasScreen(t !== "audio");
  }

  const backgroundUrl = useMemo(() => (background ? URL.createObjectURL(background.blob) : null), [background]);
  const tokenUrl = useMemo(() => (token ? URL.createObjectURL(token.blob) : null), [token]);
  useEffect(() => () => { if (backgroundUrl) URL.revokeObjectURL(backgroundUrl); }, [backgroundUrl]);
  useEffect(() => () => { if (tokenUrl) URL.revokeObjectURL(tokenUrl); }, [tokenUrl]);

  function toggleAccept(k: ArchiveKind) {
    userTouchedRef.current.accepts = true;
    setAccepts((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }
  function toggleControl(c: ControlAction) {
    userTouchedRef.current.controls = true;
    setControls((prev) => ({ ...prev, [c]: !prev[c] }));
  }

  // Lista de controles relevante ao perfil de dispositivo (mas sem esconder o resto via "mostrar tudo").
  const visibleControls: ControlAction[] = useMemo(() => {
    if (deviceType === "video") return VIDEO_CONTROL_ACTIONS;
    if (deviceType === "audio") return AUDIO_CONTROL_ACTIONS;
    // mixed: união preservando ordem
    const seen = new Set<ControlAction>();
    const out: ControlAction[] = [];
    for (const c of [...VIDEO_CONTROL_ACTIONS, ...AUDIO_CONTROL_ACTIONS]) {
      if (!seen.has(c)) { seen.add(c); out.push(c); }
    }
    return out;
  }, [deviceType]);

  function build(): CustomViewer {
    const now = Date.now();
    const baseId = loadedId ?? newViewerId();
    return {
      id: baseId,
      slug: slugify(name || "visualizador"),
      name: name.trim() || "Visualizador sem nome",
      deviceType,
      hasScreen,
      audioDisplayMode,
      accepts,
      controls,
      respectMediaControls,
      resolution,
      background: background?.blob ?? null,
      backgroundType: background?.mime ?? null,
      token: token?.blob ?? null,
      tokenType: token?.mime ?? null,
      sounds,
      scene: { items: [] },
      createdAt: now,
      updatedAt: now,
    };
  }

  async function handleSave() {
    const v = build();
    const result = await saveViewer(v);
    setLoadedId(v.id);
    setSavedAt(Date.now());
    setPublicId(result.publicId);
  }

  async function copyPublicLink() {
    if (!publicId) return;
    const url = `${window.location.origin}/v/${publicId}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      window.prompt("Copie o link:", url);
    }
  }
  async function handleExport() {
    const v = build();
    const blob = await exportViewer(v);
    downloadViewer(v, blob);
  }

  const playSound = (key: SoundKey) => {
    const s = sounds[key];
    if (!s) return;
    const url = URL.createObjectURL(s.blob);
    const audio = new Audio(url);
    void audio.play();
    audio.onended = () => URL.revokeObjectURL(url);
  };

  function setSound(key: SoundKey, file: File | null) {
    setSounds((prev) => {
      const next = { ...prev };
      if (!file) delete next[key];
      else next[key] = { blob: file, mime: file.type || "audio/mpeg" };
      return next;
    });
  }

  const audioDisplayPreviewText = useMemo(() => {
    switch (audioDisplayMode) {
      case "none": return "—";
      case "token": return "[ token da mídia ]";
      case "playback_image": return "[ imagem de reprodução ]";
      case "info": return name ? `${name} · ${formatHM(audioDisplayMode)}` : "nome · duração · ▶";
      case "custom": return "[ personalizado ]";
    }
  }, [audioDisplayMode, name]);

  return (
    <NoirShell
      title="Criador de Visualizador"
      subtitle="Forje um dispositivo. TV, rádio, gravador, walkman, vitrola — mesma arquitetura, controles e sons próprios."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr_1fr]">
        {/* ===== COLUNA ESQUERDA — CONFIGURAÇÃO ===== */}
        <section className="space-y-6 border border-border bg-card/30 p-5">
          <Block title="Tipo de Dispositivo">
            <div className="grid grid-cols-3 gap-2">
              {DEVICE_TYPES.map((t) => (
                <Toggle
                  key={t}
                  active={deviceType === t}
                  onClick={() => selectDeviceType(t)}
                >
                  {DEVICE_TYPE_LABELS[t]}
                </Toggle>
              ))}
            </div>
            <p className="mt-2 text-typewriter text-[10px] leading-snug text-muted-foreground">
              {DEVICE_HINTS[deviceType]}
            </p>
          </Block>

          <Block title="Que arquivos ele abre?">
            <div className="grid grid-cols-2 gap-2">
              {KIND_OPTIONS.map((o) => (
                <Toggle
                  key={o.kind}
                  active={accepts.includes(o.kind)}
                  onClick={() => toggleAccept(o.kind)}
                >
                  {o.label}
                </Toggle>
              ))}
            </div>
          </Block>

          <Block title="Nome do Visualizador">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={deviceType === "audio" ? "Rádio Portátil" : "Televisão da Sala"}
              className="w-full border border-border bg-background/40 px-3 py-2 text-typewriter text-sm text-foreground focus:border-amber-signal focus:outline-none"
            />
            {name && (
              <p className="mt-1 text-typewriter text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                slug: {slugify(name)}
              </p>
            )}
          </Block>

          <Block title="Tela de Exibição">
            <label className="flex cursor-pointer items-start gap-3 border border-border bg-background/30 p-3 transition-colors hover:border-amber-signal/60">
              <input
                type="checkbox"
                checked={hasScreen}
                onChange={(e) => {
                  userTouchedRef.current.screen = true;
                  setHasScreen(e.target.checked);
                }}
                className="mt-1 accent-amber-signal"
              />
              <div className="min-w-0 flex-1">
                <span className="text-typewriter text-[11px] uppercase tracking-[0.25em] text-foreground">
                  Possui tela
                </span>
                <p className="mt-1 text-typewriter text-[10px] leading-snug text-muted-foreground">
                  Quando desativado, o visualizador não reserva área de vídeo. Use para rádios, gravadores e tocadores físicos.
                </p>
              </div>
            </label>
          </Block>

          <Block title="Resolução Máxima">
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as ViewerResolution)}
              disabled={!hasScreen}
              className="w-full border border-border bg-background/40 px-3 py-2 text-typewriter text-sm text-foreground focus:border-amber-signal focus:outline-none disabled:opacity-40"
            >
              {VIEWER_RESOLUTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {!hasScreen && (
              <p className="mt-1 text-typewriter text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                sem tela — irrelevante
              </p>
            )}
          </Block>
        </section>

        {/* ===== COLUNA CENTRAL — PRÉ-VISUALIZAÇÃO ===== */}
        <section className="space-y-4">
          <div className="relative aspect-[4/3] overflow-hidden border border-border bg-black shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            {backgroundUrl ? (
              <img src={backgroundUrl} alt="cena" className="absolute inset-0 h-full w-full object-cover opacity-90" />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.16_0.018_60)_0%,oklch(0.06_0.005_60)_75%)]" />
            )}

            {/* Device chassis */}
            <div className="absolute inset-x-[10%] bottom-[8%] top-[14%] rounded-[24px] border-2 border-[oklch(0.25_0.02_60)] bg-[oklch(0.14_0.012_60)]/90 p-4 shadow-[inset_0_2px_0_rgba(255,255,255,0.04)]">
              {hasScreen ? (
                <DevicePreviewWithScreen
                  resolution={resolution}
                  audioMode={audioDisplayMode}
                  showAudioPanel={accepts.includes("audio")}
                  tokenUrl={tokenUrl}
                  name={name}
                />
              ) : (
                <NoScreenDevicePreview
                  audioMode={audioDisplayMode}
                  tokenUrl={tokenUrl}
                  name={name}
                  controls={controls}
                />
              )}
            </div>
          </div>

          {/* Token */}
          <div className="flex items-center gap-4 border border-border bg-card/30 p-3">
            <div className="grid size-16 place-content-center border border-border bg-background/40">
              {tokenUrl ? (
                <img src={tokenUrl} alt="token" className="size-full object-cover" />
              ) : (
                <span className="text-typewriter text-[9px] uppercase tracking-widest text-muted-foreground">token</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-typewriter text-[10px] uppercase tracking-[0.3em] text-amber-signal/80">
                {DEVICE_TYPE_LABELS[deviceType]} · {hasScreen ? "com tela" : "sem tela"}
              </p>
              <p className="text-serif-noir italic text-muted-foreground">
                {name || "—"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 text-typewriter border border-amber-signal bg-amber-signal py-2.5 text-xs uppercase tracking-[0.3em] text-primary-foreground hover:opacity-90"
            >
              Salvar Visualizador
            </button>
            <button
              onClick={handleExport}
              className="text-typewriter border border-border px-5 py-2.5 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:border-amber-signal hover:text-amber-signal"
            >
              Exportar
            </button>
          </div>
          {savedAt && (
            <p className="text-typewriter text-[10px] uppercase tracking-[0.3em] text-amber-signal/80">
              Salvo {new Date(savedAt).toLocaleTimeString("pt-BR")}.{" "}
              <button
                onClick={() => navigate({ to: "/biblioteca" })}
                className="underline hover:text-amber-signal"
              >
                ir para biblioteca →
              </button>
            </p>
          )}
          {publicId && (
            <div className="border border-amber-signal/30 bg-amber-signal/5 p-3">
              <p className="text-typewriter text-[10px] uppercase tracking-[0.35em] text-amber-signal/80">
                Link para os jogadores
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate border border-border bg-background/60 px-2 py-1.5 text-typewriter text-[11px] text-foreground">
                  {window.location.origin}/v/{publicId}
                </code>
                <button
                  type="button"
                  onClick={copyPublicLink}
                  className="text-typewriter border border-amber-signal/60 px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] text-amber-signal hover:bg-amber-signal/10"
                >
                  {linkCopied ? "✓" : "Copiar"}
                </button>
              </div>
            </div>
          )}

          <p className="text-typewriter text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Pré-visualização do dispositivo: {audioDisplayPreviewText}
          </p>
        </section>

        {/* ===== COLUNA DIREITA — PERSONALIZAÇÃO ===== */}
        <section className="space-y-6 border border-border bg-card/30 p-5">
          <Block title="Controles Disponíveis">
            <div className="grid grid-cols-2 gap-2">
              {visibleControls.map((c) => (
                <Toggle key={c} active={controls[c]} onClick={() => toggleControl(c)}>
                  {CONTROL_LABELS[c]}
                </Toggle>
              ))}
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-3 border border-border bg-background/30 p-3 transition-colors hover:border-amber-signal/60">
              <input
                type="checkbox"
                checked={respectMediaControls}
                onChange={(e) => setRespectMediaControls(e.target.checked)}
                className="mt-1 accent-amber-signal"
              />
              <div className="min-w-0 flex-1">
                <span className="text-typewriter text-[11px] uppercase tracking-[0.25em] text-foreground">
                  Se adequar à mídia
                </span>
                <p className="mt-1 text-typewriter text-[10px] leading-snug text-muted-foreground">
                  Respeita as funções permitidas pelo próprio arquivo. Uma fita danificada continua sem pausar mesmo num aparelho completo.
                </p>
              </div>
            </label>
          </Block>

          {(accepts.includes("audio") || deviceType !== "video") && (
            <Block title="Durante Reprodução de Áudio">
              <p className="mb-2 text-typewriter text-[10px] leading-snug text-muted-foreground">
                O que aparece {hasScreen ? "no lugar da tela" : "no painel principal"} quando uma mídia de áudio está tocando.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {AUDIO_DISPLAY_MODES.map((m) => (
                  <Toggle
                    key={m}
                    active={audioDisplayMode === m}
                    onClick={() => setAudioDisplayMode(m)}
                  >
                    {AUDIO_DISPLAY_LABELS[m]}
                  </Toggle>
                ))}
              </div>
            </Block>
          )}

          <Block title="Background da Cena">
            <FilePicker
              accept="image/*"
              value={background?.blob ?? null}
              label="Selecionar imagem"
              onChange={(f) => setBackground(f ? { blob: f, mime: f.type } : null)}
            />
          </Block>

          <Block title="Ícone (Token)">
            <FilePicker
              accept="image/*"
              value={token?.blob ?? null}
              label="Enviar imagem"
              onChange={(f) => setToken(f ? { blob: f, mime: f.type } : null)}
            />
            <p className="mt-3 text-typewriter text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              ou escolha um padrão
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {TOKEN_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.label}
                  onClick={() => {
                    const t = presetToBlob(p.id);
                    if (t) setToken(t);
                  }}
                  className="group flex aspect-square items-center justify-center border border-border bg-background/40 p-1 transition-colors hover:border-amber-signal"
                  dangerouslySetInnerHTML={{ __html: p.svg }}
                />
              ))}
            </div>
          </Block>

          <Block title="Editor de Sons">
            <p className="mb-3 text-typewriter text-[10px] leading-relaxed text-muted-foreground">
              Cada som sobrescreve o padrão do formato da mídia inserida. Bons exemplos: chiado de sintonia (rádio), motor da fita (walkman), braço da vitrola.
            </p>
            <div className="space-y-2">
              <SoundRow
                label="Inserir Mídia"
                value={sounds.insert ?? null}
                onChange={(f) => setSound("insert", f)}
                onPlay={() => playSound("insert")}
              />
              {visibleControls.map((c) => (
                <SoundRow
                  key={c}
                  label={CONTROL_LABELS[c]}
                  disabled={!controls[c]}
                  value={sounds[c] ?? null}
                  onChange={(f) => setSound(c, f)}
                  onPlay={() => playSound(c)}
                />
              ))}
            </div>
          </Block>
        </section>
      </div>
    </NoirShell>
  );
}

// ============== PREVIEW HELPERS ==============

function DevicePreviewWithScreen({
  resolution, audioMode, showAudioPanel, tokenUrl, name,
}: {
  resolution: ViewerResolution;
  audioMode: AudioDisplayMode;
  showAudioPanel: boolean;
  tokenUrl: string | null;
  name: string;
}) {
  return (
    <div className="relative h-full w-full rounded-[12px] border-[6px] border-black bg-black">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
        <span className="text-typewriter text-[9px] uppercase tracking-[0.5em] text-amber-signal/60">
          Área de Conteúdo — {resolution}
        </span>
        {showAudioPanel && (
          <AudioModePreview mode={audioMode} tokenUrl={tokenUrl} name={name} compact />
        )}
      </div>
    </div>
  );
}

function NoScreenDevicePreview({
  audioMode, tokenUrl, name, controls,
}: {
  audioMode: AudioDisplayMode;
  tokenUrl: string | null;
  name: string;
  controls: Record<ControlAction, boolean>;
}) {
  const enabled = AUDIO_CONTROL_ACTIONS.filter((c) => controls[c]);
  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-[12px] border border-amber-signal/20 bg-[oklch(0.10_0.01_60)] p-3">
      <div className="flex-1 border border-amber-signal/20 bg-black/60 p-3">
        <AudioModePreview mode={audioMode} tokenUrl={tokenUrl} name={name} />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {enabled.length === 0 ? (
          <span className="col-span-4 text-center text-typewriter text-[9px] uppercase tracking-[0.35em] text-muted-foreground">
            nenhum controle ativo
          </span>
        ) : (
          enabled.map((c) => (
            <div
              key={c}
              className="border border-amber-signal/40 bg-amber-signal/5 px-1 py-1.5 text-center text-typewriter text-[8px] uppercase tracking-[0.2em] text-amber-signal/90"
            >
              {CONTROL_LABELS[c]}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AudioModePreview({
  mode, tokenUrl, name, compact,
}: {
  mode: AudioDisplayMode;
  tokenUrl: string | null;
  name: string;
  compact?: boolean;
}) {
  const size = compact ? "size-12" : "size-20";
  switch (mode) {
    case "none":
      return (
        <div className="flex h-full items-center justify-center text-typewriter text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
          —
        </div>
      );
    case "token":
    case "playback_image":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1">
          {tokenUrl ? (
            <img src={tokenUrl} alt="" className={`${size} object-cover`} />
          ) : (
            <div className={`${size} border border-border bg-background/40 text-typewriter text-[9px] uppercase tracking-widest text-muted-foreground grid place-content-center`}>
              {mode === "token" ? "token" : "img"}
            </div>
          )}
          <span className="text-typewriter text-[9px] uppercase tracking-[0.3em] text-amber-signal/70">
            ▶ {name || "sem título"}
          </span>
        </div>
      );
    case "info":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
          <span className="text-serif-noir text-sm text-foreground">{name || "sem título"}</span>
          <span className="text-typewriter text-[9px] uppercase tracking-[0.4em] text-amber-signal/70">
            ▶ 00:42 / 03:11
          </span>
        </div>
      );
    case "custom":
      return (
        <div className="flex h-full items-center justify-center text-typewriter text-[10px] uppercase tracking-[0.35em] text-amber-signal/70">
          [ personalizado ]
        </div>
      );
  }
}

function formatHM(_: AudioDisplayMode) { return "00:42 / 03:11"; }

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-typewriter text-[10px] uppercase tracking-[0.4em] text-amber-signal/80">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Toggle({
  active, children, onClick,
}: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-typewriter border px-3 py-2 text-[11px] uppercase tracking-[0.25em] transition-colors ${
        active
          ? "border-amber-signal bg-amber-signal/15 text-amber-signal"
          : "border-border bg-background/30 text-muted-foreground hover:border-amber-signal/50 hover:text-foreground"
      }`}
    >
      {active ? "✔ " : ""}{children}
    </button>
  );
}

function FilePicker({
  accept, value, onChange, label,
}: {
  accept: string;
  value: Blob | null;
  onChange: (f: File | null) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex-1 border border-border bg-background/40 px-3 py-2 text-typewriter text-[11px] uppercase tracking-[0.25em] text-muted-foreground hover:border-amber-signal hover:text-amber-signal"
      >
        {value ? "Trocar" : label}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="border border-border px-2 py-2 text-typewriter text-[11px] uppercase text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          ✕
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onChange(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function SoundRow({
  label, value, onChange, onPlay, disabled,
}: {
  label: string;
  value: { blob: Blob; mime: string } | null;
  onChange: (f: File | null) => void;
  onPlay: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div className={`flex items-center gap-2 border border-border bg-background/30 p-2 ${disabled ? "opacity-40" : ""}`}>
      <span className="flex-1 text-typewriter text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </span>
      {value && (
        <button
          type="button"
          onClick={onPlay}
          className="text-typewriter border border-border px-2 py-1 text-[10px] uppercase text-amber-signal/80 hover:bg-amber-signal/10"
        >
          ▶
        </button>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="text-typewriter border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:border-amber-signal hover:text-amber-signal disabled:cursor-not-allowed"
      >
        {value ? "trocar" : "anexar"}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-typewriter border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          ✕
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onChange(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
