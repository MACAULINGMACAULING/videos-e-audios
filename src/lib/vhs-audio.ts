// Synthesized VHS sound effects using Web Audio API.
// No external assets needed.

let ctx: AudioContext | null = null;
function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function envGain(start: number, peak: number, hold: number, release: number, level = 0.4) {
  const a = ac();
  const g = a.createGain();
  const t = a.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + start);
  g.gain.exponentialRampToValueAtTime(level, t + start + peak);
  g.gain.exponentialRampToValueAtTime(level * 0.6, t + start + peak + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + start + peak + hold + release);
  return { g, end: t + start + peak + hold + release };
}

function noiseBuffer(seconds: number) {
  const a = ac();
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * seconds), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function playInsert() {
  const a = ac();
  // mechanical clunk: low thump + spring
  const osc = a.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, a.currentTime + 0.25);
  const env = envGain(0.005, 0.02, 0.05, 0.25, 0.35);
  osc.connect(env.g).connect(a.destination);
  osc.start();
  osc.stop(env.end);

  // mechanical whir
  const noise = a.createBufferSource();
  noise.buffer = noiseBuffer(0.6);
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 800;
  bp.Q.value = 6;
  const ng = envGain(0.05, 0.1, 0.2, 0.3, 0.18);
  noise.connect(bp).connect(ng.g).connect(a.destination);
  noise.start();
  noise.stop(ng.end);
}

export function playEject() {
  const a = ac();
  const osc = a.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(220, a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(110, a.currentTime + 0.4);
  const env = envGain(0.005, 0.03, 0.1, 0.4, 0.3);
  osc.connect(env.g).connect(a.destination);
  osc.start();
  osc.stop(env.end);

  const noise = a.createBufferSource();
  noise.buffer = noiseBuffer(0.5);
  const bp = a.createBiquadFilter();
  bp.type = "lowpass";
  bp.frequency.value = 1200;
  const ng = envGain(0.02, 0.08, 0.15, 0.25, 0.15);
  noise.connect(bp).connect(ng.g).connect(a.destination);
  noise.start();
  noise.stop(ng.end);
}

// Sustained whine for rewind / fast-forward, controllable via stop().
export function startRewind(direction: "rew" | "ff") {
  const a = ac();
  const osc = a.createOscillator();
  osc.type = "sawtooth";
  const base = direction === "rew" ? 520 : 680;
  osc.frequency.setValueAtTime(base, a.currentTime);
  // slight wobble
  const lfo = a.createOscillator();
  lfo.frequency.value = 6;
  const lfoGain = a.createGain();
  lfoGain.gain.value = 20;
  lfo.connect(lfoGain).connect(osc.frequency);

  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = base;
  bp.Q.value = 8;

  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.12, a.currentTime + 0.08);

  const noise = a.createBufferSource();
  noise.buffer = noiseBuffer(2);
  noise.loop = true;
  const ng = a.createGain();
  ng.gain.value = 0.04;
  const nbp = a.createBiquadFilter();
  nbp.type = "highpass";
  nbp.frequency.value = 2000;
  noise.connect(nbp).connect(ng).connect(a.destination);

  osc.connect(bp).connect(g).connect(a.destination);
  osc.start();
  lfo.start();
  noise.start();

  return () => {
    const t = a.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.stop(t + 0.15);
    lfo.stop(t + 0.15);
    noise.stop(t + 0.15);
  };
}

export function playClick() {
  const a = ac();
  const osc = a.createOscillator();
  osc.type = "square";
  osc.frequency.value = 1400;
  const env = envGain(0.001, 0.005, 0.005, 0.03, 0.08);
  osc.connect(env.g).connect(a.destination);
  osc.start();
  osc.stop(env.end);
}
