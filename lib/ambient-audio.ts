export const AMBIENT_TRACKS = [
  { id: "rain", label: "빗소리" },
  { id: "cafe", label: "카페" },
  { id: "forest", label: "숲" },
  { id: "waves", label: "파도" },
  { id: "fire", label: "모닥불" },
  { id: "stream", label: "시냇물" },
  { id: "night", label: "밤" },
] as const;

export type AmbientTrackId = (typeof AMBIENT_TRACKS)[number]["id"];

export type AmbientSnapshot = {
  track: AmbientTrackId;
  volume: number;
  playing: boolean;
};

const STORAGE_KEY = "ritual:ambient";

// Cafe: Marble Toast, CC0 1.0, https://commons.wikimedia.org/wiki/File:Cafe_ambiance.ogg
// Forest: nille, public domain, https://commons.wikimedia.org/wiki/File:20090610_0_ambience.ogg
// Campfire: Glaneur de sons, CC BY 3.0, https://freesound.org/people/Glaneur%20de%20sons/sounds/29727/
const RECORDINGS: Partial<Record<AmbientTrackId, string>> = {
  cafe: "/sounds/cafe.mp3",
  forest: "/sounds/forest.mp3",
  fire: "/sounds/campfire.mp3",
};

export const CAMPFIRE_CREDIT = {
  author: "Glaneur de sons",
  license: "CC BY 3.0",
  licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  sourceUrl: "https://freesound.org/people/Glaneur%20de%20sons/sounds/29727/",
} as const;

let activeRecording: HTMLAudioElement | null = null;

const initialSnapshot: AmbientSnapshot = {
  track: "rain",
  volume: 0.45,
  playing: false,
};

let snapshot = initialSnapshot;
let hydrated = false;
const listeners = new Set<() => void>();

let context: AudioContext | null = null;
let master: GainNode | null = null;
let cleanups: Array<() => void> = [];

function isTrack(value: unknown): value is AmbientTrackId {
  return AMBIENT_TRACKS.some((track) => track.id === value);
}

function emit(next: AmbientSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function persist(next: Pick<AmbientSnapshot, "track" | "volume">) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The in-memory choice still applies for this visit.
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "");
    if (!raw || typeof raw !== "object") return;
    const record = raw as Record<string, unknown>;
    const track = isTrack(record.track) ? record.track : snapshot.track;
    const volume =
      typeof record.volume === "number" && Number.isFinite(record.volume)
        ? Math.min(1, Math.max(0, record.volume))
        : snapshot.volume;
    snapshot = { ...snapshot, track, volume };
  } catch {
    // Keep the default rain track.
  }
}

function rememberPlaying(playing: boolean) {
  if (snapshot.playing === playing) return;
  emit({ ...snapshot, playing });
}

function audioContext() {
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = snapshot.volume;
    master.connect(context.destination);
  }
  if (master) master.gain.value = snapshot.volume;
  if (context.state === "suspended") void context.resume();
  return context;
}

function own(cleanup: () => void) {
  cleanups.push(cleanup);
}

function noiseBuffer(ctx: AudioContext, seconds: number, color: "white" | "pink" | "brown") {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.02 * white) / 1.02;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.1840926;
    const pink = b0 + b1 + b2 + white * 0.1848;
    data[index] = color === "white" ? white * 0.4 : color === "brown" ? brown * 3.4 : pink * 0.12;
  }
  return buffer;
}

function loopNoise(
  ctx: AudioContext,
  output: AudioNode,
  color: "white" | "pink" | "brown",
  shape: { type: BiquadFilterType; frequency: number; q?: number; gain: number },
) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, 3, color);
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = shape.type;
  filter.frequency.value = shape.frequency;
  filter.Q.value = shape.q ?? 0.7;
  const gain = ctx.createGain();
  gain.gain.value = shape.gain;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  source.start();
  own(() => {
    try {
      source.stop();
    } catch {
      // Already stopped.
    }
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  });
  return { filter, gain };
}

function every(minMs: number, maxMs: number, fn: () => void) {
  let id = 0;
  const arm = (delay: number) => {
    id = window.setTimeout(() => {
      fn();
      arm(minMs + Math.random() * (maxMs - minMs));
    }, delay);
  };
  arm(180 + Math.random() * minMs);
  own(() => window.clearTimeout(id));
}

function burst(ctx: AudioContext, output: AudioNode, seconds: number, frequency: number, gainValue: number) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * Math.exp(-index / (length * 0.22));
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  source.start();
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}

function lfo(ctx: AudioContext, param: AudioParam, rate: number, depth: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = rate;
  gain.gain.value = depth;
  osc.connect(gain);
  gain.connect(param);
  osc.start();
  own(() => {
    try {
      osc.stop();
    } catch {
      // Already stopped.
    }
    osc.disconnect();
    gain.disconnect();
  });
}

function rhythm(periodMs: number, fn: () => void) {
  const id = window.setInterval(fn, periodMs);
  own(() => window.clearInterval(id));
}

function rain(ctx: AudioContext, output: AudioNode) {
  loopNoise(ctx, output, "pink", { type: "highpass", frequency: 2200, gain: 0.28 });
  loopNoise(ctx, output, "brown", { type: "lowpass", frequency: 700, gain: 0.36 });
  every(30, 90, () => burst(ctx, output, 0.012 + Math.random() * 0.02, 2800 + Math.random() * 2200, 0.05 + Math.random() * 0.08));
  every(180, 520, () => burst(ctx, output, 0.02 + Math.random() * 0.03, 900 + Math.random() * 700, 0.2 + Math.random() * 0.35));
}

function waves(ctx: AudioContext, output: AudioNode) {
  const wash = loopNoise(ctx, output, "brown", { type: "lowpass", frequency: 480, gain: 0.02 });
  const cycle = () => {
    const at = ctx.currentTime;
    wash.gain.gain.cancelScheduledValues(at);
    wash.gain.gain.setValueAtTime(0.03, at);
    wash.gain.gain.linearRampToValueAtTime(0.5, at + 1.3);
    wash.gain.gain.exponentialRampToValueAtTime(0.04, at + 4.8);
    burst(ctx, output, 0.45, 700 + Math.random() * 400, 0.35);
  };
  cycle();
  rhythm(6500, cycle);
}

function stream(ctx: AudioContext, output: AudioNode) {
  const water = loopNoise(ctx, output, "pink", { type: "bandpass", frequency: 1800, q: 0.35, gain: 0.34 });
  loopNoise(ctx, output, "white", { type: "highpass", frequency: 3200, gain: 0.07 });
  lfo(ctx, water.filter.frequency, 0.4, 180);
  every(120, 380, () => burst(ctx, output, 0.02 + Math.random() * 0.03, 600 + Math.random() * 900, 0.08 + Math.random() * 0.12));
}

function cricket(ctx: AudioContext, output: AudioNode, frequency: number) {
  const at = ctx.currentTime + 0.005;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = frequency;
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 14;
  gain.gain.setValueAtTime(0.0001, at);
  for (let index = 0; index < 4; index += 1) {
    const time = at + index * 0.042;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.028, time + 0.006);
    gain.gain.linearRampToValueAtTime(0.0001, time + 0.024);
  }
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  const end = at + 0.2;
  osc.start(at);
  osc.stop(end);
  osc.onended = () => {
    osc.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}

function night(ctx: AudioContext, output: AudioNode) {
  loopNoise(ctx, output, "brown", { type: "lowpass", frequency: 160, gain: 0.045 });
  rhythm(520, () => cricket(ctx, output, 4680));
  rhythm(780, () => cricket(ctx, output, 4120));
}

function playRecording(url: string) {
  const ctx = audioContext();
  const output = master ?? ctx.destination;
  const audio = new Audio();
  audio.loop = true;
  audio.preload = "auto";
  audio.src = url;
  const source = ctx.createMediaElementSource(audio);
  source.connect(output);
  activeRecording = audio;
  void audio.play().catch(() => {
    if (activeRecording === audio) rememberPlaying(false);
  });
  own(() => {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    source.disconnect();
    if (activeRecording === audio) activeRecording = null;
  });
}

function startBed() {
  const ctx = audioContext();
  stopBed();
  const recording = RECORDINGS[snapshot.track];
  if (recording) {
    playRecording(recording);
    return;
  }
  const output = master ?? ctx.destination;
  const beds: Partial<Record<AmbientTrackId, (context: AudioContext, node: AudioNode) => void>> = {
    rain,
    waves,
    stream,
    night,
  };
  beds[snapshot.track]?.(ctx, output);
}

export function getAmbientPlaybackUrl() {
  if (!activeRecording?.src) return null;
  try {
    return new URL(activeRecording.src).pathname;
  } catch {
    return activeRecording.src;
  }
}

function stopBed() {
  const pending = cleanups;
  cleanups = [];
  for (const cleanup of pending) {
    try {
      cleanup();
    } catch {
      // A node may already be stopped.
    }
  }
}

export function subscribeAmbient(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAmbientSnapshot() {
  hydrate();
  return snapshot;
}

export function getAmbientServerSnapshot() {
  return initialSnapshot;
}

export function setAmbientTrack(track: AmbientTrackId) {
  hydrate();
  if (snapshot.track === track && snapshot.playing) {
    pauseAmbient();
    return;
  }
  emit({ ...snapshot, track });
  persist({ track, volume: snapshot.volume });
  playAmbient();
}

export function setAmbientVolume(volume: number) {
  hydrate();
  const next = Math.min(1, Math.max(0, volume));
  if (master) master.gain.value = next;
  emit({ ...snapshot, volume: next });
  persist({ track: snapshot.track, volume: next });
}

export function playAmbient() {
  if (typeof window === "undefined") return;
  hydrate();
  try {
    startBed();
    rememberPlaying(true);
  } catch {
    rememberPlaying(false);
  }
}

export function pauseAmbient() {
  stopBed();
  rememberPlaying(false);
}

export function exportAmbientSettings() {
  hydrate();
  return { track: snapshot.track, volume: snapshot.volume };
}

export function applyAmbientSettings(next: { track: AmbientTrackId; volume: number }) {
  hydrate();
  const playing = snapshot.playing;
  if (master) master.gain.value = next.volume;
  emit({ track: next.track, volume: next.volume, playing });
  persist({ track: next.track, volume: next.volume });
  if (playing) startBed();
}
