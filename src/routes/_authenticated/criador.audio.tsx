import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { NoirShell } from "@/components/noir-shell";
import {
  formatLabel,
  newArchiveId,
  type AudioArchive,
  type MediaFormat,
  type ViewerId,
} from "@/lib/archive/types";
import { VIEWERS, suggestedViewersForFormat } from "@/lib/archive/viewers";
import { getArchive, saveArchive } from "@/lib/archive/db";
import { downloadArchive, exportArchive } from "@/lib/archive/export";
import {
  CONTROL_ACTIONS,
  CONTROL_LABELS,
  defaultAllowedMediaControls,
  type ControlAction,
} from "@/lib/archive/viewer-types";
import { SOUND_KEYS, SOUND_LABELS } from "@/lib/archive/sound-chain";

export const Route = createFileRoute("/_authenticated/criador/audio")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Criador de Áudio — Archive WEAVER" },
      { name: "description", content: "Compose uma evidência sonora: formato, token, compatibilidade." },
      { property: "og:title", content: "Criador de Áudio — Archive WEAVER" },
      { property: "og:description", content: "Compose uma evidência sonora: formato, token, compatibilidade." },
    ],
  }),
  component: CriadorAudio,
});

type FormatChoice = "cassette" | "cd" | "vinyl" | "digital" | "other";

function CriadorAudio() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();

  const [archiveId, setArchiveId] = useState(() => id ?? newArchiveId());
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formatChoice, setFormatChoice] = useState<FormatChoice>("cassette");
  const [otherFormat, setOtherFormat] = useState("");
  const [token, setToken] = useState<Blob | null>(null);
  const [tokenType, setTokenType] = useState("image/png");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioType, setAudioType] = useState("audio/mpeg");
  const [playbackImage, setPlaybackImage] = useState<Blob | null>(null);
  const [playbackImageType, setPlaybackImageType] = useState("image/png");
  const [transcript, setTranscript] = useState("");
  const [compatibleViewers, setCompatibleViewers] = useState<ViewerId[]>(["cassette-recorder"]);
  const [autoplay, setAutoplay] = useState(true);
  const [loop, setLoop] = useState(false);
  const [allowedControls, setAllowedControls] = useState<Record<ControlAction, boolean>>(
    defaultAllowedMediaControls(),
  );
  const [customSounds, setCustomSounds] = useState<Record<string, { blob: Blob; mime: string }>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const createdAtRef = useRef<number>(Date.now());
  const userTouchedViewersRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    void getArchive(id).then((a) => {
      if (!a || a.kind !== "audio") return;
      setArchiveId(a.id);
      setName(a.name);
      setDescription(a.description);
      const fk = a.format.kind;
      if (fk === "cassette" || fk === "cd" || fk === "vinyl" || fk === "digital") {
        setFormatChoice(fk);
        setOtherFormat("");
      } else {
        setFormatChoice("other");
        setOtherFormat(fk === "other" ? a.format.label : "");
      }
      setToken(a.token);
      setTokenType(a.tokenType);
      setAudio(a.payload.audio);
      setAudioType(a.payload.audioType);
      if (a.payload.playbackImage) {
        setPlaybackImage(a.payload.playbackImage);
        setPlaybackImageType(a.payload.playbackImageType ?? "image/png");
      }
      setTranscript(a.payload.transcript ?? "");
      setCompatibleViewers(a.compatibleViewers);
      setAutoplay(a.autoplay);
      setLoop(a.loop);
      if (a.allowedControls) {
        setAllowedControls({ ...defaultAllowedMediaControls(), ...a.allowedControls });
      }
      if (a.customSounds) setCustomSounds(a.customSounds);
      createdAtRef.current = a.createdAt;
      userTouchedViewersRef.current = true;
    });
  }, [id]);

  const format: MediaFormat = useMemo(() => {
    if (formatChoice === "other") {
      return { kind: "other", label: otherFormat.trim() || "Formato Próprio" };
    }
    return { kind: formatChoice };
  }, [formatChoice, otherFormat]);

  useEffect(() => {
    if (userTouchedViewersRef.current) return;
    setCompatibleViewers(suggestedViewersForFormat(format, "audio"));
  }, [format]);

  const tokenUrl = useMemo(() => (token ? URL.createObjectURL(token) : null), [token]);
  const audioUrl = useMemo(() => (audio ? URL.createObjectURL(audio) : null), [audio]);
  const playbackImageUrl = useMemo(
    () => (playbackImage ? URL.createObjectURL(playbackImage) : null),
    [playbackImage],
  );
  useEffect(() => () => { if (tokenUrl) URL.revokeObjectURL(tokenUrl); }, [tokenUrl]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => () => { if (playbackImageUrl) URL.revokeObjectURL(playbackImageUrl); }, [playbackImageUrl]);

  const canSave = !!token && !!audio && name.trim().length > 0 && compatibleViewers.length > 0;

  function build(): AudioArchive | null {
    if (!token || !audio) return null;
    return {
      id: archiveId,
      kind: "audio",
      name: name.trim() || "Sem título",
      description: description.trim(),
      token,
      tokenType,
      format,
      compatibleViewers,
      autoplay,
      loop,
      allowedControls,
      customSounds: Object.keys(customSounds).length ? customSounds : undefined,
      createdAt: createdAtRef.current,
      updatedAt: Date.now(),
      payload: {
        audio,
        audioType,
        playbackImage: playbackImage ?? undefined,
        playbackImageType: playbackImage ? playbackImageType : undefined,
        transcript: transcript.trim() ? transcript : undefined,
      },
    };
  }

  async function handleSave() {
    const a = build();
    if (!a) return;
    setSaving(true);
    await saveArchive(a);
    setSaving(false);
    setSavedAt(Date.now());
  }

  async function handleExport() {
    const a = build();
    if (!a) return;
    await saveArchive(a);
    const blob = await exportArchive(a);
    downloadArchive(a, blob);
    setSavedAt(Date.now());
  }

  function toggleViewer(v: ViewerId) {
    userTouchedViewersRef.current = true;
    setCompatibleViewers((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  }

  const formatChoices: { value: FormatChoice; label: string }[] = [
    { value: "cassette", label: "Cassete" },
    { value: "cd", label: "CD" },
    { value: "vinyl", label: "Vinil" },
    { value: "digital", label: "Digital" },
    { value: "other", label: "Outro" },
  ];

  return (
    <NoirShell title="Criador de Áudio" subtitle="Forje a evidência sonora.">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr_1fr]">
        {/* ============ LEFT ============ */}
        <div className="space-y-6">
          <Section code="C-01" label="Formato">
            <div className="grid grid-cols-3 gap-2">
              {formatChoices.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setFormatChoice(c.value)}
                  className={`text-typewriter border px-2 py-2 text-[10px] uppercase tracking-[0.25em] transition-colors ${
                    formatChoice === c.value
                      ? "border-amber-signal bg-amber-signal text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-amber-signal hover:text-amber-signal"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {formatChoice === "other" && (
              <input
                value={otherFormat}
                onChange={(e) => setOtherFormat(e.target.value)}
                placeholder="Mensagem de Voz, Ligação Interceptada..."
                className="mt-3 w-full border border-border bg-card/40 px-3 py-2 text-typewriter text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-amber-signal focus:outline-none"
              />
            )}
          </Section>

          <Section code="C-02" label="Nome do Áudio">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Entrevista 04"
              className="w-full border-b border-border bg-transparent py-2 text-serif-noir text-2xl text-foreground placeholder:text-muted-foreground/40 focus:border-amber-signal focus:outline-none"
            />
          </Section>

          <Section code="C-03" label="Descrição">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexto, data, observações narrativas."
              rows={4}
              className="w-full resize-none border border-border bg-card/40 p-3 text-typewriter text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-amber-signal focus:outline-none"
            />
          </Section>

          <Section code="C-04" label="Token">
            <FileSelect
              accept="image/png,image/jpeg,image/webp"
              hint="Cassete, CD, disco, gravador — a aparência física"
              fileName={token ? "token carregado" : null}
              onFile={(f) => { setToken(f); setTokenType(f.type); }}
            />
          </Section>

          <Section code="C-05" label="Áudio">
            <FileSelect
              accept="audio/mpeg,audio/wav,audio/ogg,audio/flac,audio/webm,audio/*"
              hint="MP3, WAV, OGG, FLAC, WEBM"
              fileName={audio ? "áudio carregado" : null}
              onFile={(f) => { setAudio(f); setAudioType(f.type || "audio/mpeg"); }}
            />
          </Section>

          <Section code="C-06" label="Imagem de Reprodução (opcional)">
            <p className="mb-2 text-typewriter text-[10px] leading-snug tracking-widest text-muted-foreground">
              Aparece no visualizador enquanto o áudio toca. Capa, foto, forma de onda.
            </p>
            <FileSelect
              accept="image/png,image/jpeg,image/webp"
              hint="PNG, JPG, WEBP"
              fileName={playbackImage ? "imagem carregada" : null}
              onFile={(f) => { setPlaybackImage(f); setPlaybackImageType(f.type); }}
            />
            {playbackImage && (
              <button
                type="button"
                onClick={() => setPlaybackImage(null)}
                className="mt-2 text-typewriter text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive"
              >
                Remover imagem
              </button>
            )}
          </Section>
        </div>

        {/* ============ CENTER ============ */}
        <div className="space-y-6">
          <p className="text-typewriter text-[10px] uppercase tracking-[0.4em] text-amber-signal/80">
            Pré-visualização
          </p>

          <div className="relative aspect-video overflow-hidden border-4 border-[oklch(0.22_0.02_60)] bg-black shadow-[inset_0_0_80px_rgba(0,0,0,0.9),0_30px_60px_rgba(0,0,0,0.5)]">
            {playbackImageUrl && (
              <img
                src={playbackImageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-90"
              />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4">
              {audioUrl ? (
                <audio src={audioUrl} controls className="w-full" preload="metadata" />
              ) : (
                <p className="text-center text-typewriter text-xs uppercase tracking-[0.5em] text-muted-foreground">
                  Áudio
                </p>
              )}
            </div>
            {!audioUrl && !playbackImageUrl && (
              <div className="flex h-full items-center justify-center">
                <span className="text-typewriter text-xs uppercase tracking-[0.5em] text-muted-foreground">
                  ♪
                </span>
              </div>
            )}
          </div>

          <div className="border border-border bg-card/40 p-4">
            <p className="text-typewriter text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
              Token — Aparência Física
            </p>
            <div className="mt-3 flex justify-center">
              <div className="relative aspect-[1.6/1] w-56 border border-border bg-[oklch(0.15_0.01_60)]">
                {tokenUrl ? (
                  <>
                    <img src={tokenUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
                    <div className="absolute inset-x-3 top-3 bg-paper/95 px-2 py-1 text-typewriter text-[10px] uppercase tracking-wider text-ink shadow">
                      {name || "Sem título"}
                    </div>
                    <div className="absolute inset-x-3 bottom-3 text-typewriter text-[9px] uppercase tracking-widest text-amber-signal/80">
                      {formatLabel(format)}
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-typewriter text-xs uppercase tracking-[0.4em] text-muted-foreground">
                    Token
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-dashed border-border pt-6">
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="text-typewriter flex-1 border border-amber-signal bg-amber-signal px-6 py-2 text-xs uppercase tracking-[0.3em] text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Salvando..." : "Salvar Arquivo"}
            </button>
            <button
              onClick={handleExport}
              disabled={!canSave}
              className="text-typewriter flex-1 border border-amber-signal/60 px-6 py-2 text-xs uppercase tracking-[0.3em] text-amber-signal transition-colors hover:bg-amber-signal hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Exportar Arquivo
            </button>
          </div>
          {savedAt && (
            <p className="text-typewriter text-[10px] uppercase tracking-widest text-muted-foreground">
              Arquivado às {new Date(savedAt).toLocaleTimeString("pt-BR")}
            </p>
          )}
          <button
            onClick={() => navigate({ to: "/criar" })}
            className="text-typewriter w-full border border-border px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Voltar
          </button>
        </div>

        {/* ============ RIGHT ============ */}
        <div className="space-y-6">
          <Section code="V-01" label="Visualizadores Compatíveis">
            <p className="mb-3 text-typewriter text-[10px] tracking-widest text-muted-foreground">
              Apenas os dispositivos marcados poderão reproduzir este arquivo.
            </p>
            <div className="space-y-2">
              {VIEWERS.map((v) => {
                const accepted = v.accepts.includes("audio");
                const checked = compatibleViewers.includes(v.id);
                return (
                  <label
                    key={v.id}
                    className={`flex cursor-pointer items-start gap-3 border p-3 transition-colors ${
                      checked
                        ? "border-amber-signal bg-amber-signal/5"
                        : "border-border hover:border-amber-signal/60"
                    } ${!accepted ? "opacity-40" : ""}`}
                  >
                    <input
                      type="checkbox"
                      disabled={!accepted}
                      checked={checked}
                      onChange={() => toggleViewer(v.id)}
                      className="mt-1 accent-amber-signal"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-serif-noir text-base text-foreground">
                          {v.label}
                        </span>
                        {v.preferredFormat && (
                          <span className="text-typewriter text-[9px] uppercase tracking-widest text-amber-signal/60">
                            {v.preferredFormat}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-typewriter text-[11px] leading-snug text-muted-foreground">
                        {v.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </Section>

          <Section code="V-02" label="Reprodução">
            <div className="space-y-3 text-typewriter text-xs uppercase tracking-widest">
              <label className="flex cursor-pointer items-center justify-between border border-border bg-card/40 px-3 py-2">
                <span>Autoplay</span>
                <input
                  type="checkbox"
                  checked={autoplay}
                  onChange={(e) => setAutoplay(e.target.checked)}
                  className="accent-amber-signal"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between border border-border bg-card/40 px-3 py-2">
                <span>Loop</span>
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={(e) => setLoop(e.target.checked)}
                  className="accent-amber-signal"
                />
              </label>
            </div>
          </Section>

          <Section code="V-03" label="Funções Permitidas">
            <p className="mb-3 text-typewriter text-[10px] leading-snug tracking-widest text-muted-foreground">
              Funções que a própria mídia autoriza. Visualizadores que respeitam restrições da mídia bloqueiam o que estiver desativado aqui.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CONTROL_ACTIONS.map((c) => {
                const active = allowedControls[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setAllowedControls((prev) => ({ ...prev, [c]: !prev[c] }))
                    }
                    className={`text-typewriter border px-3 py-2 text-[11px] uppercase tracking-[0.25em] transition-colors ${
                      active
                        ? "border-amber-signal bg-amber-signal/15 text-amber-signal"
                        : "border-border bg-background/30 text-muted-foreground hover:border-amber-signal/50 hover:text-foreground"
                    }`}
                  >
                    {active ? "✔ " : "✖ "}
                    {CONTROL_LABELS[c]}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section code="V-04" label="Sons Personalizados">
            <p className="mb-3 text-typewriter text-[10px] leading-snug tracking-widest text-muted-foreground">
              Sons opcionais da própria mídia. Quando definidos, substituem o som do visualizador para aquela ação.
            </p>
            <div className="space-y-2">
              {SOUND_KEYS.map((k) => (
                <MediaSoundRow
                  key={k}
                  label={SOUND_LABELS[k]}
                  value={customSounds[k] ?? null}
                  onChange={(f) =>
                    setCustomSounds((prev) => {
                      const next = { ...prev };
                      if (!f) delete next[k];
                      else next[k] = { blob: f, mime: f.type || "audio/mpeg" };
                      return next;
                    })
                  }
                />
              ))}
            </div>
          </Section>

          <div className="border border-dashed border-border bg-card/20 p-3 text-typewriter text-[10px] leading-relaxed text-muted-foreground">
            <span className="text-amber-signal/80">Nota: </span>
            cada arquivo de áudio é um objeto narrativo. Formato físico, aparência, restrições e sons compõem a evidência.
          </div>
        </div>
      </div>
    </NoirShell>
  );
}

function Section({ code, label, children }: { code: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-3">
        <span className="text-typewriter text-[10px] uppercase tracking-[0.35em] text-amber-signal/70">
          {code}
        </span>
        <span className="text-typewriter text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function FileSelect({
  accept, hint, fileName, onFile,
}: {
  accept: string;
  hint: string;
  fileName: string | null;
  onFile: (f: File) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col items-start gap-1 border border-dashed border-border bg-card/30 p-4 text-typewriter text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:border-amber-signal hover:text-amber-signal">
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <span>{fileName ?? "Selecionar Arquivo"}</span>
      <span className="text-[9px] opacity-60">{hint}</span>
    </label>
  );
}

function MediaSoundRow({
  label, value, onChange,
}: {
  label: string;
  value: { blob: Blob; mime: string } | null;
  onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  function play() {
    if (!value) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(value.blob);
    previewUrlRef.current = url;
    const a = new Audio(url);
    void a.play().catch(() => {});
  }

  return (
    <div className="flex items-center gap-2 border border-border bg-background/30 p-2">
      <span className="flex-1 text-typewriter text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </span>
      {value && (
        <button
          type="button"
          onClick={play}
          className="text-typewriter border border-border px-2 py-1 text-[10px] uppercase text-amber-signal/80 hover:bg-amber-signal/10"
        >
          ▶
        </button>
      )}
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="text-typewriter border border-border px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:border-amber-signal hover:text-amber-signal"
      >
        {value ? "Trocar" : "Adicionar"}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="border border-border px-2 py-1 text-typewriter text-[10px] uppercase text-muted-foreground hover:border-destructive hover:text-destructive"
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
