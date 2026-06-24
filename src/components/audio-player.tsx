import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AudioArchive } from "@/lib/archive/types";
import type { ControlAction, CustomViewer } from "@/lib/archive/viewer-types";

interface Props {
  archive: AudioArchive;
  viewer: CustomViewer | null;
  controls: Record<ControlAction, boolean>;
  playSound: (key: ControlAction | "insert") => void;
  onEject: () => void;
}

/**
 * AudioPlayer — renderiza a área principal de reprodução de áudio dentro
 * do chassis do visualizador. Suporta:
 *  - Onda sonora em tempo real (showWaveform)
 *  - Legendas/transcrição (allowSubtitles + payload.transcript)
 *  - Token do visualizador como imagem central (useTokenAsDisplay)
 *  - Modos de exibição (audioDisplayMode)
 */
export function AudioPlayer({ archive, viewer, controls, playSound, onEject }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showSubtitles, setShowSubtitles] = useState(false);

  const audioUrl = useMemo(() => URL.createObjectURL(archive.payload.audio), [archive]);
  const tokenViewerUrl = useMemo(
    () => (viewer?.token ? URL.createObjectURL(viewer.token) : null),
    [viewer],
  );
  const tokenMediaUrl = useMemo(() => URL.createObjectURL(archive.token), [archive]);
  const playbackImageUrl = useMemo(
    () => (archive.payload.playbackImage ? URL.createObjectURL(archive.payload.playbackImage) : null),
    [archive],
  );

  useEffect(() => () => { URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => () => { if (tokenViewerUrl) URL.revokeObjectURL(tokenViewerUrl); }, [tokenViewerUrl]);
  useEffect(() => () => { URL.revokeObjectURL(tokenMediaUrl); }, [tokenMediaUrl]);
  useEffect(() => () => { if (playbackImageUrl) URL.revokeObjectURL(playbackImageUrl); }, [playbackImageUrl]);

  const showWaveform = viewer?.showWaveform ?? false;
  const allowSubtitles = viewer?.allowSubtitles ?? false;
  const useTokenAsDisplay = viewer?.useTokenAsDisplay ?? false;
  const displayMode = viewer?.audioDisplayMode ?? "token";
  const transcript = archive.payload.transcript;

  // === Web Audio for waveform ===
  useEffect(() => {
    if (!showWaveform) return;
    const el = audioRef.current;
    if (!el) return;
    let ctx: AudioContext;
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch { return; }
    const src = ctx.createMediaElementSource(el);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    return () => {
      try { src.disconnect(); analyser.disconnect(); } catch { /* ignore */ }
      void ctx.close();
      audioCtxRef.current = null;
      analyserRef.current = null;
    };
  }, [showWaveform, audioUrl]);

  // Draw waveform
  useEffect(() => {
    if (!showWaveform) return;
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const bins = analyser.frequencyBinCount;
    const data = new Uint8Array(bins);

    const draw = () => {
      analyser.getByteTimeDomainData(data);
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "rgba(8, 6, 4, 0.85)";
      ctx.fillRect(0, 0, w, h);
      // Grid baseline
      ctx.strokeStyle = "rgba(220, 160, 60, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      // Waveform
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = playing ? "rgba(245, 180, 70, 0.95)" : "rgba(245, 180, 70, 0.45)";
      ctx.beginPath();
      const step = w / bins;
      for (let i = 0; i < bins; i++) {
        const v = data[i] / 128 - 1; // -1..1
        const y = h / 2 + v * (h / 2 - 4);
        if (i === 0) ctx.moveTo(i * step, y);
        else ctx.lineTo(i * step, y);
      }
      ctx.stroke();
      // Progress marker
      if (duration > 0) {
        const px = (currentTime / duration) * w;
        ctx.strokeStyle = "rgba(245, 180, 70, 0.9)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [showWaveform, playing, currentTime, duration]);

  // Loaded metadata + autoplay
  function handleLoadedMeta() {
    const el = audioRef.current;
    if (!el) return;
    setDuration(el.duration || 0);
    if (archive.autoplay) {
      void el.play().then(() => { setPlaying(true); playSound("play"); }).catch(() => {});
    }
  }

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onEnded = () => { setPlaying(false); playSound("stop"); };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
    };
  }, [audioUrl, playSound]);

  // Volume
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  // Resume AudioContext on play (required by browser autoplay policy)
  const ensureAudioCtx = () => {
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "suspended") void ctx.resume();
  };

  const handlePlay = useCallback(() => {
    ensureAudioCtx();
    playSound("play");
    void audioRef.current?.play();
    setPlaying(true);
  }, [playSound]);
  const handlePause = useCallback(() => {
    playSound("pause"); audioRef.current?.pause(); setPlaying(false);
  }, [playSound]);
  const handleStop = useCallback(() => {
    playSound("stop");
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; setCurrentTime(0); }
    setPlaying(false);
  }, [playSound]);
  const skip = useCallback((dt: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + dt));
    setCurrentTime(el.currentTime);
  }, []);
  const handleFf = useCallback(() => { playSound("ff"); skip(10); }, [playSound, skip]);
  const handleRw = useCallback(() => { playSound("rw"); skip(-10); }, [playSound, skip]);
  const adjustVolume = useCallback((delta: number) => {
    setVolume((v) => Math.max(0, Math.min(1, +(v + delta).toFixed(2))));
    playSound(delta > 0 ? "volUp" : "volDown");
  }, [playSound]);

  return (
    <div className="relative flex w-full flex-col items-center gap-5">
      {/* === HIDDEN AUDIO ELEMENT === */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={handleLoadedMeta}
        loop={archive.loop}
        preload="metadata"
        className="hidden"
      />

      {/* === DEVICE CHASSIS === */}
      <div className="relative w-full max-w-2xl rounded-[32px] border-2 border-[oklch(0.25_0.02_60)] bg-[oklch(0.14_0.012_60)] p-6 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8),inset_0_2px_0_rgba(255,255,255,0.04)]">
        {/* Central display panel */}
        <div className="relative flex aspect-[16/9] w-full flex-col overflow-hidden rounded-[16px] border-[6px] border-black bg-[oklch(0.06_0.01_60)] shadow-[inset_0_0_80px_rgba(0,0,0,0.95)]">
          {/* Background layer: token or playback image */}
          <DisplayLayer
            useTokenAsDisplay={useTokenAsDisplay}
            tokenViewerUrl={tokenViewerUrl}
            tokenMediaUrl={tokenMediaUrl}
            playbackImageUrl={playbackImageUrl}
            displayMode={displayMode}
          />

          {/* No automatic overlays drawn over the audio display.
              Optional waveform / subtitles are creator-controlled and rendered below. */}


          {/* Waveform overlay */}
          {showWaveform && (
            <div className="absolute inset-x-3 bottom-3 z-10 h-20 overflow-hidden rounded border border-amber-signal/30 bg-black/70">
              <canvas
                ref={canvasRef}
                width={800}
                height={120}
                className="h-full w-full"
              />
            </div>
          )}

          {/* Subtitle drawer */}
          {allowSubtitles && transcript && showSubtitles && (
            <div className="absolute inset-x-4 top-10 z-20 max-h-[60%] overflow-y-auto rounded border border-amber-signal/40 bg-black/90 p-3 text-typewriter text-xs leading-relaxed text-amber-signal/90 shadow-lg">
              <div className="mb-2 flex items-center justify-between border-b border-amber-signal/20 pb-1 text-[9px] uppercase tracking-[0.4em]">
                <span>Transcrição</span>
                <button
                  type="button"
                  onClick={() => setShowSubtitles(false)}
                  className="text-amber-signal/70 hover:text-amber-signal"
                >
                  ✕
                </button>
              </div>
              <p className="whitespace-pre-wrap">{transcript}</p>
            </div>
          )}
        </div>
      </div>

      {/* === SUBTITLE TOGGLE === */}
      {allowSubtitles && transcript && (
        <button
          type="button"
          onClick={() => setShowSubtitles((s) => !s)}
          className="text-typewriter border border-amber-signal/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] text-amber-signal/80 hover:bg-amber-signal/10"
        >
          {showSubtitles ? "Ocultar legendas" : "Mostrar legendas"}
        </button>
      )}

      {/* === CONTROLS === */}
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-md border border-[oklch(0.22_0.02_60)] bg-[oklch(0.13_0.012_60)] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
        {controls.rw && <Btn label="−10s" onClick={handleRw}>◀◀</Btn>}
        {controls.play && <Btn label="Play" onClick={handlePlay} active={playing}>▶</Btn>}
        {controls.pause && <Btn label="Pause" onClick={handlePause}>❚❚</Btn>}
        {controls.stop && <Btn label="Stop" onClick={handleStop}>■</Btn>}
        {controls.ff && <Btn label="+10s" onClick={handleFf}>▶▶</Btn>}
        {(controls.volDown || controls.volUp) && (
          <div className="mx-2 h-8 w-px bg-border" />
        )}
        {controls.volDown && <Btn label="Vol −" onClick={() => adjustVolume(-0.1)}>−</Btn>}
        {controls.volUp && <Btn label="Vol +" onClick={() => adjustVolume(0.1)}>+</Btn>}
        {controls.eject && (
          <>
            <div className="mx-2 h-8 w-px bg-border" />
            <Btn label="Ejetar" onClick={onEject} variant="warn">⏏</Btn>
          </>
        )}
      </div>

      {/* Progress */}
      {duration > 0 && (
        <div className="flex w-full max-w-xl items-center gap-3 text-typewriter text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={(e) => {
              if (audioRef.current) {
                audioRef.current.currentTime = Number(e.target.value);
                setCurrentTime(audioRef.current.currentTime);
              }
            }}
            className="flex-1 accent-amber-signal"
          />
          <span>{formatTime(duration)}</span>
          <span className="ml-2">vol {Math.round(volume * 100)}%</span>
        </div>
      )}
    </div>
  );
}

function DisplayLayer({
  useTokenAsDisplay, tokenViewerUrl, tokenMediaUrl, playbackImageUrl, displayMode,
}: {
  useTokenAsDisplay: boolean;
  tokenViewerUrl: string | null;
  tokenMediaUrl: string;
  playbackImageUrl: string | null;
  displayMode: string;
}) {
  // Priority: useTokenAsDisplay wins; else playback_image > token > info > none.
  if (useTokenAsDisplay && tokenViewerUrl) {
    return (
      <img src={tokenViewerUrl} alt="" className="absolute inset-0 h-full w-full object-contain opacity-90" />
    );
  }
  if (displayMode === "playback_image" && playbackImageUrl) {
    return <img src={playbackImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />;
  }
  if (displayMode === "token") {
    return <img src={tokenMediaUrl} alt="" className="absolute inset-0 h-full w-full object-contain opacity-85" />;
  }
  if (displayMode === "info") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-typewriter text-amber-signal/70">
        <span className="text-[10px] uppercase tracking-[0.5em]">▶ reproduzindo</span>
      </div>
    );
  }
  // none / custom
  return null;
}

function Btn({
  children, label, onClick, active, variant,
}: {
  children: React.ReactNode; label: string; onClick: () => void;
  active?: boolean; variant?: "warn";
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`text-typewriter relative flex h-12 min-w-14 items-center justify-center border-b-4 px-3 text-sm transition-all active:translate-y-[2px] active:border-b-0 ${
        variant === "warn"
          ? "border-amber-signal/40 bg-[oklch(0.18_0.02_60)] text-amber-signal hover:bg-amber-signal hover:text-primary-foreground"
          : "border-black bg-[oklch(0.18_0.018_60)] text-muted-foreground hover:text-amber-signal"
      } ${active ? "text-amber-signal" : ""}`}
    >
      <span>{children}</span>
      <span className="absolute -bottom-5 text-[9px] uppercase tracking-widest opacity-70">{label}</span>
    </button>
  );
}

function formatTime(s: number) {
  if (!isFinite(s)) return "00:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
