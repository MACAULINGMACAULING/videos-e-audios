import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readArchiveFile } from "@/lib/archive/export";
import type { ArchiveFile, AudioArchive, MediaFormat, VideoArchive } from "@/lib/archive/types";
import type { Tape } from "@/lib/tape-types";
import { preloadMediaSounds } from "@/lib/archive/media-sounds";
import { playChainedSound, type SoundChainSources } from "@/lib/archive/sound-chain";
import { getPublicViewerByPublicId } from "@/lib/archive/viewer-db";
import {
  defaultAllowedMediaControls,
  resolveAvailableControls,
  type CustomViewer,
} from "@/lib/archive/viewer-types";
import { InspectionOverlay } from "@/components/inspection-overlay";
import { AudioPlayer } from "@/components/audio-player";

export const Route = createFileRoute("/v/$publicId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Visualizador Compartilhado — Archive WEAVER" },
      { name: "description", content: "Insira a evidência recebida do mestre." },
      { property: "og:title", content: "Visualizador Compartilhado — Archive WEAVER" },
      { property: "og:description", content: "Insira a evidência recebida do mestre." },
    ],
  }),
  component: PublicPlayer,
});

type Stage = "empty" | "preview" | "inserting" | "loading" | "playing" | "ejecting";

function archiveToTape(a: VideoArchive): Tape {
  return {
    id: a.id, name: a.name, description: a.description,
    cover: a.token, coverType: a.tokenType,
    video: a.payload.video, videoType: a.payload.videoType,
    effects: a.payload.effects, autoplay: a.autoplay, loop: a.loop,
    customSounds: a.customSounds,
    allowedControls: a.allowedControls,
    createdAt: a.createdAt, updatedAt: a.updatedAt,
  };
}

function PublicPlayer() {
  const { publicId } = Route.useParams();
  const [customViewer, setCustomViewer] = useState<CustomViewer | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    void getPublicViewerByPublicId(publicId)
      .then((v) => { if (v) setCustomViewer(v); else setNotFound(true); })
      .catch(() => setNotFound(true));
  }, [publicId]);

  const acceptsKinds = customViewer?.accepts ?? ["video"];
  const baseControls = customViewer?.controls ?? defaultAllowedMediaControls();
  const respectMediaControls = customViewer?.respectMediaControls ?? true;
  const deviceLabel = customViewer?.name ?? "Visualizador";

  const [stage, setStage] = useState<Stage>("empty");
  const [pendingTape, setPendingTape] = useState<Tape | null>(null);
  const [pendingAudio, setPendingAudio] = useState<AudioArchive | null>(null);
  const [tape, setTape] = useState<Tape | null>(null);
  const [audioArchive, setAudioArchive] = useState<AudioArchive | null>(null);
  const [format, setFormat] = useState<MediaFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const controlsCfg = useMemo(
    () => resolveAvailableControls(baseControls, tape?.allowedControls, respectMediaControls),
    [baseControls, tape, respectMediaControls],
  );

  // Cadeia de áudio: MÍDIA > VISUALIZADOR > FORMATO > SISTEMA.
  const soundSources = useMemo<SoundChainSources>(() => ({
    mediaCustom: (tape ?? pendingTape)?.customSounds ?? audioArchive?.customSounds ?? pendingAudio?.customSounds,
    viewerCustom: customViewer?.sounds,
    mediaFormat: format,
  }), [tape, pendingTape, audioArchive, pendingAudio, customViewer, format]);

  const playSound = useCallback(
    (key: Parameters<typeof playChainedSound>[0]) => playChainedSound(key, soundSources),
    [soundSources],
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const scrubRef = useRef<{ raf: number; stop: () => void } | null>(null);

  const videoUrl = useMemo(() => (tape?.video ? URL.createObjectURL(tape.video) : null), [tape]);
  const backgroundUrl = useMemo(
    () => (customViewer?.background ? URL.createObjectURL(customViewer.background) : null),
    [customViewer],
  );
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => () => { if (backgroundUrl) URL.revokeObjectURL(backgroundUrl); }, [backgroundUrl]);

  async function handlePickFile(file: File) {
    setError(null);
    try {
      const archive: ArchiveFile = await readArchiveFile(file);
      if (!acceptsKinds.includes(archive.kind)) {
        setError(`Mídia incompatível com este dispositivo (${deviceLabel}).`);
        return;
      }
      preloadMediaSounds(archive.format);
      setFormat(archive.format);
      if (archive.kind === "audio") {
        setPendingAudio(archive);
        setStage("preview");
        return;
      }
      if (archive.kind !== "video") {
        setError("Este visualizador ainda não reproduz esse tipo de mídia.");
        return;
      }
      setPendingTape(archiveToTape(archive));
      setStage("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao ler o arquivo.");
    }
  }

  function handleConfirmInsert() {
    if (!pendingTape && !pendingAudio) return;
    playSound("insert");
    setStage("inserting");
    setTimeout(() => {
      if (pendingAudio) {
        setAudioArchive(pendingAudio);
        setPendingAudio(null);
        setStage("playing");
      } else if (pendingTape) {
        setStage("loading");
        setTape(pendingTape);
      }
    }, 1300);
  }
  function handleCancelPreview() { setPendingTape(null); setPendingAudio(null); setFormat(null); setStage("empty"); }

  function handleVideoLoaded() {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
    setStage("playing");
    if (tape?.autoplay) void videoRef.current.play().then(() => {
      setPlaying(true);
      playSound("play");
    }).catch(() => {});
  }

  const handlePlay = useCallback(() => {
    playSound("play"); videoRef.current?.play(); setPlaying(true);
  }, [playSound]);
  const handlePause = useCallback(() => {
    playSound("pause"); videoRef.current?.pause(); setPlaying(false);
  }, [playSound]);
  const handleStop = useCallback(() => {
    playSound("stop");
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; setCurrentTime(0); }
    setPlaying(false);
  }, [playSound]);
  const handleEject = useCallback(() => {
    playSound("eject");
    setStage("ejecting");
    if (videoRef.current) videoRef.current.pause();
    setPlaying(false);
    setTimeout(() => {
      setTape(null); setPendingTape(null); setAudioArchive(null); setPendingAudio(null); setFormat(null);
      setStage("empty"); setCurrentTime(0); setDuration(0);
    }, 1100);
  }, [playSound]);

  const handleAudioEject = useCallback(() => {
    playSound("eject"); setAudioArchive(null); setPendingAudio(null); setFormat(null); setStage("empty");
  }, [playSound]);

  const startScrub = useCallback((dir: "rew" | "ff") => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    v.pause(); setPlaying(false);
    const stopAudio = () => {};
    let last = performance.now();
    const speed = 6;
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      const next = v.currentTime + (dir === "rew" ? -1 : 1) * speed * dt;
      v.currentTime = Math.max(0, Math.min(v.duration || 0, next));
      setCurrentTime(v.currentTime);
      scrubRef.current!.raf = requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    scrubRef.current = { raf, stop: stopAudio };
  }, []);
  const stopScrub = useCallback(() => {
    if (!scrubRef.current) return;
    cancelAnimationFrame(scrubRef.current.raf);
    scrubRef.current.stop();
    scrubRef.current = null;
  }, []);
  const nudgeFrame = useCallback((dir: "back" | "fwd") => {
    if (!videoRef.current) return;
    playSound("frame");
    const v = videoRef.current;
    v.pause(); setPlaying(false);
    const step = 1 / 30;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + (dir === "fwd" ? step : -step)));
    setCurrentTime(v.currentTime);
  }, [playSound]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onEnded = () => {
      setPlaying(false);
      playSound("stop");
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
    };
  }, [tape, playSound]);

  const effects = tape?.effects ?? pendingTape?.effects ?? {
    noise: 0, scanlines: 0, tracking: 0, ghosting: 0, chromatic: 0, signalLoss: 0, tapeDamage: 0,
  };

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <p className="text-typewriter text-[10px] uppercase tracking-[0.4em] text-amber-signal/80">
            Sinal Perdido
          </p>
          <h1 className="mt-4 text-serif-noir text-5xl font-light text-foreground">Link inválido</h1>
          <p className="mt-3 text-typewriter text-sm text-muted-foreground">
            Este visualizador não existe ou foi removido pelo mestre.
          </p>
        </div>
      </div>
    );
  }

  if (!customViewer) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-typewriter text-xs uppercase tracking-[0.5em] text-amber-signal animate-pulse">
          Sintonizando...
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[oklch(0.08_0.008_60)] px-4 py-10">
      {backgroundUrl ? (
        <>
          <img src={backgroundUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70" />
          <div className="pointer-events-none absolute inset-0 bg-black/40" />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.18_0.02_60)_0%,oklch(0.06_0.005_60)_70%)]" />
      )}

      <div className="absolute left-6 top-6 z-10 text-typewriter text-[10px] uppercase tracking-[0.4em] text-amber-signal/80">
        {deviceLabel}
      </div>

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center">
        {audioArchive ? (
          <AudioPlayer
            archive={audioArchive}
            viewer={customViewer}
            controls={controlsCfg}
            playSound={playSound}
            onEject={handleAudioEject}
          />
        ) : (
        <>
        <div className="relative w-full">
          <div className="relative rounded-[40px] border-2 border-[oklch(0.25_0.02_60)] bg-[oklch(0.14_0.012_60)] p-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8),inset_0_2px_0_rgba(255,255,255,0.04)]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] border-[10px] border-black bg-black shadow-[inset_0_0_120px_rgba(0,0,0,1)]">
              {videoUrl && (
                <video ref={videoRef} src={videoUrl} onLoadedMetadata={handleVideoLoaded} loop={tape?.loop} playsInline
                  className="absolute inset-0 h-full w-full object-cover animate-flicker" />
              )}
              {stage === "empty" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-amber-signal/70">
                  <span className="text-typewriter text-xs uppercase tracking-[0.5em]">Sem Sinal</span>
                  <span className="text-serif-noir italic text-muted-foreground">— insira uma mídia —</span>
                </div>
              )}
              {stage === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <div className="text-center">
                    <div className="text-typewriter text-xs uppercase tracking-[0.5em] text-amber-signal animate-pulse">
                      Carregando...
                    </div>
                    <div className="mt-3 h-1 w-48 overflow-hidden bg-amber-signal/20">
                      <div className="h-full w-1/3 animate-[tracking-roll_1.5s_linear_infinite] bg-amber-signal" />
                    </div>
                  </div>
                </div>
              )}
              {stage === "ejecting" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <span className="text-typewriter text-xs uppercase tracking-[0.5em] text-amber-signal/60">
                    Ejetando...
                  </span>
                </div>
              )}
              {stage === "playing" && <VhsOverlay effects={effects} />}
              {tape && stage === "playing" && (
                <>
                  <div className="absolute left-4 top-3 z-20 text-typewriter text-sm text-amber-signal drop-shadow-[0_0_6px_currentColor]">
                    {playing ? "▶ PLAY" : "❚❚ PAUSE"}
                  </div>
                  <div className="absolute right-4 top-3 z-20 text-typewriter text-sm text-amber-signal drop-shadow-[0_0_6px_currentColor]">
                    SP {formatTime(currentTime)}
                  </div>
                </>
              )}
            </div>
            <div className="relative mt-6">
              <div className="mx-auto h-3 w-2/3 rounded-sm bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]" />
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 rounded-md border border-[oklch(0.22_0.02_60)] bg-[oklch(0.13_0.012_60)] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
          {controlsCfg.rw && (
            <HoldButton label="Retroceder" disabled={stage !== "playing"} onPress={() => startScrub("rew")} onRelease={stopScrub}>◀◀</HoldButton>
          )}
          <TransportBtn label="Play" disabled={stage !== "playing"} onClick={handlePlay} active={playing}>▶</TransportBtn>
          {controlsCfg.pause && (
            <TransportBtn label="Pause" disabled={stage !== "playing"} onClick={handlePause}>❚❚</TransportBtn>
          )}
          <TransportBtn label="Stop" disabled={stage !== "playing"} onClick={handleStop}>■</TransportBtn>
          {controlsCfg.ff && (
            <HoldButton label="Avançar" disabled={stage !== "playing"} onPress={() => startScrub("ff")} onRelease={stopScrub}>▶▶</HoldButton>
          )}
          {controlsCfg.frame && (
            <>
              <div className="mx-2 h-8 w-px bg-border" />
              <TransportBtn label="◂ Quadro" disabled={stage !== "playing"} onClick={() => nudgeFrame("back")}>◂|</TransportBtn>
              <TransportBtn label="Quadro ▸" disabled={stage !== "playing"} onClick={() => nudgeFrame("fwd")}>|▸</TransportBtn>
            </>
          )}
          {controlsCfg.eject && (
            <>
              <div className="mx-2 h-8 w-px bg-border" />
              <TransportBtn label="Ejetar" disabled={stage !== "playing"} onClick={handleEject} variant="warn">⏏</TransportBtn>
            </>
          )}
        </div>

        {controlsCfg.timeline && stage === "playing" && duration > 0 && (
          <div className="mt-3 flex w-full max-w-xl items-center gap-3 text-typewriter text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <input type="range" min={0} max={duration} step={1 / 30} value={currentTime}
              onChange={(e) => { if (videoRef.current) videoRef.current.currentTime = Number(e.target.value); }}
              className="flex-1 accent-amber-signal" />
            <span>{formatTime(duration)}</span>
          </div>
        )}
        </>
        )}

        <div className="mt-10">
          <button onClick={() => fileInputRef.current?.click()}
            className="text-typewriter border border-amber-signal bg-amber-signal/10 px-8 py-3 text-xs uppercase tracking-[0.4em] text-amber-signal transition-colors hover:bg-amber-signal hover:text-primary-foreground">
            Inserir Mídia
          </button>
          <input ref={fileInputRef} type="file" accept=".archive,application/x-archive-weaver,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handlePickFile(f);
              e.target.value = "";
            }} />
        </div>

        {error && (
          <p className="mt-4 text-typewriter text-xs uppercase tracking-widest text-destructive">{error}</p>
        )}
      </div>

      {stage === "preview" && pendingTape && (
        <InspectionOverlay
          tokenBlob={pendingTape.cover}
          name={pendingTape.name}
          description={pendingTape.description}
          onConfirm={handleConfirmInsert}
          onCancel={handleCancelPreview}
        />
      )}
      {stage === "preview" && pendingAudio && (
        <InspectionOverlay
          tokenBlob={pendingAudio.token}
          name={pendingAudio.name}
          description={pendingAudio.description}
          onConfirm={handleConfirmInsert}
          onCancel={handleCancelPreview}
        />
      )}
    </div>
  );
}

function TransportBtn({
  children, label, onClick, disabled, active, variant,
}: {
  children: React.ReactNode; label: string; onClick: () => void;
  disabled?: boolean; active?: boolean; variant?: "warn";
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={label}
      className={`text-typewriter relative flex h-12 min-w-14 items-center justify-center border-b-4 px-3 text-sm transition-all active:translate-y-[2px] active:border-b-0 disabled:cursor-not-allowed disabled:opacity-30 ${
        variant === "warn"
          ? "border-amber-signal/40 bg-[oklch(0.18_0.02_60)] text-amber-signal hover:bg-amber-signal hover:text-primary-foreground"
          : "border-black bg-[oklch(0.18_0.018_60)] text-muted-foreground hover:text-amber-signal"
      } ${active ? "text-amber-signal" : ""}`}>
      <span>{children}</span>
      <span className="absolute -bottom-5 text-[9px] uppercase tracking-widest opacity-70">{label}</span>
    </button>
  );
}

function HoldButton({
  children, label, onPress, onRelease, disabled,
}: {
  children: React.ReactNode; label: string;
  onPress: () => void; onRelease: () => void; disabled?: boolean;
}) {
  const handlers = {
    onMouseDown: () => !disabled && onPress(),
    onMouseUp: () => !disabled && onRelease(),
    onMouseLeave: () => !disabled && onRelease(),
    onTouchStart: (e: React.TouchEvent) => { if (!disabled) { e.preventDefault(); onPress(); } },
    onTouchEnd: () => !disabled && onRelease(),
  };
  return (
    <button {...handlers} disabled={disabled} title={label}
      className="text-typewriter relative flex h-12 min-w-14 items-center justify-center border-b-4 border-black bg-[oklch(0.18_0.018_60)] px-3 text-sm text-muted-foreground transition-all hover:text-amber-signal active:translate-y-[2px] active:border-b-0 active:bg-amber-signal/20 active:text-amber-signal disabled:cursor-not-allowed disabled:opacity-30">
      <span>{children}</span>
      <span className="absolute -bottom-5 text-[9px] uppercase tracking-widest opacity-70">{label}</span>
    </button>
  );
}

function formatTime(s: number) {
  if (!isFinite(s)) return "00:00:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
