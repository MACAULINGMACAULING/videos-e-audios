import { useEffect, useRef } from "react";
import type { VhsEffects } from "@/lib/tape-types";

interface Props {
  effects: VhsEffects;
  className?: string;
}

/**
 * Renders a stack of CRT / VHS visual overlays on top of children.
 * All overlays are CSS / canvas and pointer-events:none.
 */
export function VhsOverlay({ effects, className = "" }: Props) {
  const noiseRef = useRef<HTMLCanvasElement>(null);

  // Animated TV noise canvas
  useEffect(() => {
    const canvas = noiseRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const img = ctx.createImageData(w, h);
      const intensity = effects.noise / 100;
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255 * intensity;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255 * (intensity * 0.6);
      }
      ctx.putImageData(img, 0, 0);
      raf = requestAnimationFrame(draw);
    };
    canvas.width = 320;
    canvas.height = 200;
    if (effects.noise > 0) draw();
    return () => cancelAnimationFrame(raf);
  }, [effects.noise]);

  const scanlineOpacity = effects.scanlines / 100;
  const trackingOpacity = effects.tracking / 100;
  const ghostOpacity = effects.ghosting / 100;
  const chromatic = (effects.chromatic / 100) * 4; // px
  const signalLoss = effects.signalLoss / 100;
  const tapeDamage = effects.tapeDamage / 100;

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Noise */}
      {effects.noise > 0 && (
        <canvas
          ref={noiseRef}
          className="absolute inset-0 h-full w-full mix-blend-screen"
          style={{ opacity: 0.45 * (effects.noise / 100) }}
        />
      )}

      {/* Scanlines */}
      {effects.scanlines > 0 && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.5) 3px, rgba(0,0,0,0.5) 4px)",
            opacity: scanlineOpacity,
            mixBlendMode: "multiply",
          }}
        />
      )}

      {/* Tracking roll */}
      {effects.tracking > 0 && (
        <div
          className="absolute inset-x-0 h-12"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.18) 45%, rgba(0,0,0,0.6) 55%, transparent 100%)",
            opacity: trackingOpacity,
            animation: `tracking-roll ${Math.max(2, 10 - effects.tracking / 12)}s linear infinite`,
            mixBlendMode: "overlay",
          }}
        />
      )}

      {/* Ghosting */}
      {effects.ghosting > 0 && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0, rgba(255,255,255,0.05) 50%, transparent 100%)",
            opacity: ghostOpacity * 0.5,
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* Chromatic / horizontal distortion */}
      {effects.chromatic > 0 && (
        <div
          className="absolute inset-0"
          style={{
            boxShadow: `inset ${chromatic}px 0 0 rgba(255,0,40,0.18), inset -${chromatic}px 0 0 rgba(0,200,255,0.18)`,
          }}
        />
      )}

      {/* Signal loss bars */}
      {effects.signalLoss > 0 && (
        <div
          className="absolute inset-0 animate-signal-loss"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent 0 80%, rgba(0,0,0,0.85) 80% 82%, transparent 82% 100%)",
            backgroundSize: `100% ${100 + Math.random() * 50}px`,
            opacity: signalLoss * 0.6,
          }}
        />
      )}

      {/* Tape damage spots */}
      {effects.tapeDamage > 0 && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 23% 31%, rgba(255,255,255,0.5) 0 1px, transparent 2px), radial-gradient(circle at 67% 72%, rgba(0,0,0,0.6) 0 2px, transparent 3px), radial-gradient(circle at 12% 80%, rgba(255,255,255,0.4) 0 1px, transparent 2px)",
            opacity: tapeDamage,
          }}
        />
      )}

      {/* Vignette + CRT curve */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.85) 100%)",
        }}
      />
    </div>
  );
}
