import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { NoirShell } from "@/components/noir-shell";
import { DEFAULT_EFFECTS } from "@/lib/tape-types";
import {
  RESOLUTIONS,
  formatLabel,
  newArchiveId,
  type MediaFormat,
  type Resolution,
  type VideoArchive,
  type ViewerId,
} from "@/lib/archive/types";
import { VIEWERS, suggestedViewersForFormat } from "@/lib/archive/viewers";
import { getArchive, saveArchive } from "@/lib/archive/db";
import { downloadArchive, exportArchive } from "@/lib/archive/export";

export const Route = createFileRoute("/_authenticated/criador/video")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Criador de Vídeo — Archive WEAVER" },
      { name: "description", content: "Compose uma evidência em vídeo: formato, token, compatibilidade." },
      { property: "og:title", content: "Criador de Vídeo — Archive WEAVER" },
      { property: "og:description", content: "Compose uma evidência em vídeo: formato, token, compatibilidade." },
    ],
  }),
  component: CriadorVideo,
});

type FormatChoice = "vhs" | "dvd" | "other";

function CriadorVideo() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();

  const [archiveId, setArchiveId] = useState(() => id ?? newArchiveId());
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formatChoice, setFormatChoice] = useState<FormatChoice>("vhs");
  const [otherFormat, setOtherFormat] = useState("");
  const [token, setToken] = useState<Blob | null>(null);
  const [tokenType, setTokenType] = useState("image/png");
  const [video, setVideo] = useState<Blob | null>(null);
  const [videoType, setVideoType] = useState("video/mp4");
  const [resolution, setResolution] = useState<Resolution>("1280x720");
  const [compatibleViewers, setCompatibleViewers] = useState<ViewerId[]>(["tv-vhs"]);
  const [autoplay, setAutoplay] = useState(true);
  const [loop, setLoop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const createdAtRef = useRef<number>(Date.now());
  const userTouchedViewersRef = useRef(false);

  // Load existing archive
  useEffect(() => {
    if (!id) return;
    void getArchive(id).then((a) => {
      if (!a || a.kind !== "video") return;
      setArchiveId(a.id);
      setName(a.name);
      setDescription(a.description);
      setFormatChoice(a.format.kind === "other" ? "other" : a.format.kind);
      setOtherFormat(a.format.kind === "other" ? a.format.label : "");
      setToken(a.token);
      setTokenType(a.tokenType);
      setVideo(a.payload.video);
      setVideoType(a.payload.videoType);
      setResolution(a.payload.resolution);
      setCompatibleViewers(a.compatibleViewers);
      setAutoplay(a.autoplay);
      setLoop(a.loop);
      createdAtRef.current = a.createdAt;
      userTouchedViewersRef.current = true;
    });
  }, [id]);

  const format: MediaFormat = useMemo(() => {
    if (formatChoice === "vhs") return { kind: "vhs" };
    if (formatChoice === "dvd") return { kind: "dvd" };
    return { kind: "other", label: otherFormat.trim() || "Formato Próprio" };
  }, [formatChoice, otherFormat]);

  // Auto-suggest compatible viewers when format changes (unless user customized)
  useEffect(() => {
    if (userTouchedViewersRef.current) return;
    setCompatibleViewers(suggestedViewersForFormat(format, "video"));
  }, [format]);

  const tokenUrl = useMemo(() => (token ? URL.createObjectURL(token) : null), [token]);
  const videoUrl = useMemo(() => (video ? URL.createObjectURL(video) : null), [video]);
  useEffect(() => () => { if (tokenUrl) URL.revokeObjectURL(tokenUrl); }, [tokenUrl]);
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  const canSave = !!token && !!video && name.trim().length > 0 && compatibleViewers.length > 0;

  function build(): VideoArchive | null {
    if (!token || !video) return null;
    return {
      id: archiveId,
      kind: "video",
      name: name.trim() || "Sem título",
      description: description.trim(),
      token,
      tokenType,
      format,
      compatibleViewers,
      autoplay,
      loop,
      createdAt: createdAtRef.current,
      updatedAt: Date.now(),
      payload: {
        video,
        videoType,
        resolution,
        effects: DEFAULT_EFFECTS,
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

  const otherPlaceholders = ["Disquete de Vídeo", "Fita Experimental", "Formato Próprio"];

  return (
    <NoirShell title="Criador de Vídeo" subtitle="Forje a evidência audiovisual.">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr_1fr]">
        {/* ============ LEFT: configuration ============ */}
        <div className="space-y-6">
          <Section code="C-01" label="Formato">
            <div className="flex gap-2">
              {(["vhs", "dvd", "other"] as FormatChoice[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormatChoice(c)}
                  className={`text-typewriter flex-1 border px-3 py-2 text-[11px] uppercase tracking-[0.3em] transition-colors ${
                    formatChoice === c
                      ? "border-amber-signal bg-amber-signal text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-amber-signal hover:text-amber-signal"
                  }`}
                >
                  {c === "vhs" ? "VHS" : c === "dvd" ? "DVD" : "Outro"}
                </button>
              ))}
            </div>
            {formatChoice === "other" && (
              <input
                value={otherFormat}
                onChange={(e) => setOtherFormat(e.target.value)}
                placeholder={otherPlaceholders[Math.floor(Date.now() / 5000) % 3]}
                className="mt-3 w-full border border-border bg-card/40 px-3 py-2 text-typewriter text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-amber-signal focus:outline-none"
              />
            )}
          </Section>

          <Section code="C-02" label="Nome do Vídeo">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Entrevista 01"
              className="w-full border-b border-border bg-transparent py-2 text-serif-noir text-2xl text-foreground placeholder:text-muted-foreground/40 focus:border-amber-signal focus:outline-none"
            />
          </Section>

          <Section code="C-03" label="Descrição">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Resumo, contexto narrativo, metadados da investigação."
              rows={4}
              className="w-full resize-none border border-border bg-card/40 p-3 text-typewriter text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-amber-signal focus:outline-none"
            />
          </Section>

          <Section code="C-04" label="Token">
            <FileSelect
              accept="image/png,image/jpeg,image/webp"
              hint="PNG, JPG, WEBP — a aparência física do arquivo"
              fileName={token ? "token carregado" : null}
              onFile={(f) => { setToken(f); setTokenType(f.type); }}
            />
          </Section>

          <Section code="C-05" label="Vídeo">
            <FileSelect
              accept="video/mp4,video/webm"
              hint="MP4, WEBM"
              fileName={video ? "vídeo carregado" : null}
              onFile={(f) => { setVideo(f); setVideoType(f.type); }}
            />
          </Section>

          <Section code="C-06" label="Resolução">
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as Resolution)}
              className="w-full border border-border bg-card/40 px-3 py-2 text-typewriter text-sm text-foreground focus:border-amber-signal focus:outline-none"
            >
              {RESOLUTIONS.map((r) => (
                <option key={r} value={r} className="bg-background">{r}</option>
              ))}
            </select>
          </Section>
        </div>

        {/* ============ CENTER: preview ============ */}
        <div className="space-y-6">
          <p className="text-typewriter text-[10px] uppercase tracking-[0.4em] text-amber-signal/80">
            Pré-visualização
          </p>

          <div className="relative aspect-video overflow-hidden border-4 border-[oklch(0.22_0.02_60)] bg-black shadow-[inset_0_0_80px_rgba(0,0,0,0.9),0_30px_60px_rgba(0,0,0,0.5)]">
            {videoUrl ? (
              <video
                src={videoUrl}
                controls
                preload="metadata"
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="text-typewriter text-xs uppercase tracking-[0.5em] text-muted-foreground">
                  Vídeo
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

        {/* ============ RIGHT: compatibility + playback ============ */}
        <div className="space-y-6">
          <Section code="V-01" label="Visualizadores Compatíveis">
            <p className="mb-3 text-typewriter text-[10px] tracking-widest text-muted-foreground">
              Apenas os dispositivos marcados poderão reproduzir este arquivo.
            </p>
            <div className="space-y-2">
              {VIEWERS.map((v) => {
                const accepted = v.accepts.includes("video");
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

          <div className="border border-dashed border-border bg-card/20 p-3 text-typewriter text-[10px] leading-relaxed text-muted-foreground">
            <span className="text-amber-signal/80">Nota: </span>
            no Archive WEAVER, cada arquivo é um objeto narrativo. Conteúdo, aparência, compatibilidade e comportamento — todos importam.
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