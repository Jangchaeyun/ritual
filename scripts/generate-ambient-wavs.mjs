// Playback does not use these files. Cafe, forest, and campfire use the MP3 recordings in public/sounds.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sampleRate = 22050;
const seconds = 6;
const count = sampleRate * seconds;
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sounds");

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function signed(random) {
  return random() * 2 - 1;
}

function crossfade(samples) {
  const span = Math.floor(sampleRate * 0.08);
  const next = samples.slice();
  for (let index = 0; index < span; index += 1) {
    const fade = index / span;
    const head = samples[index] * fade;
    const tail = samples[count - span + index] * (1 - fade);
    next[index] = head + tail;
  }
  return next;
}

function normalize(samples, peak = 0.72) {
  let max = 0;
  for (const sample of samples) max = Math.max(max, Math.abs(sample));
  if (max === 0) return samples;
  const gain = peak / max;
  return samples.map((sample) => sample * gain);
}

function rain() {
  const random = createRng(0x51a11);
  const samples = new Array(count);
  let bed = 0;
  let drop = 0;
  let until = 1200;
  for (let index = 0; index < count; index += 1) {
    bed += 0.12 * (signed(random) - bed);
    if (index >= until) {
      drop = 0.45 + random() * 0.55;
      until = index + 700 + Math.floor(random() * 2800);
    }
    drop *= 0.985;
    samples[index] = bed * 0.7 + signed(random) * drop * 0.55;
  }
  return samples;
}

function cafe() {
  const random = createRng(0xc0ffee);
  const samples = new Array(count);
  let brown = 0;
  for (let index = 0; index < count; index += 1) {
    brown = (brown + 0.02 * signed(random)) * 0.985;
    const murmur = 0.72 + 0.28 * Math.sin((index / sampleRate) * Math.PI * 2 * 0.42);
    const clink = random() > 0.997 ? signed(random) * 0.35 : 0;
    samples[index] = brown * murmur * 2.4 + clink;
  }
  return samples;
}

function forest() {
  const random = createRng(0xf0457);
  const samples = new Array(count);
  let low = 0;
  const chirps = [];
  for (let index = 0; index < count; index += 1) {
    const white = signed(random);
    low += 0.04 * (white - low);
    const leaves = (white - low) * 0.35;
    if (random() > 0.9992) {
      chirps.push({
        at: index,
        freq: 1600 + random() * 2200,
        life: Math.floor(sampleRate * (0.08 + random() * 0.12)),
        gain: 0.25 + random() * 0.2,
      });
    }
    let tone = 0;
    for (let cursor = chirps.length - 1; cursor >= 0; cursor -= 1) {
      const chirp = chirps[cursor];
      const age = index - chirp.at;
      if (age >= chirp.life) {
        chirps.splice(cursor, 1);
        continue;
      }
      const envelope = Math.sin((age / chirp.life) * Math.PI);
      tone += Math.sin((age / sampleRate) * Math.PI * 2 * chirp.freq) * envelope * chirp.gain;
    }
    samples[index] = leaves + tone * 0.45;
  }
  return samples;
}

function wav(samples) {
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + samples.length * 2, 4);
  data.write("WAVE", 8);
  data.write("fmt ", 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(sampleRate, 24);
  data.writeUInt32LE(sampleRate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    data.writeInt16LE(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, 44 + index * 2);
  });
  return data;
}

mkdirSync(root, { recursive: true });
for (const [name, build] of [["rain", rain]]) {
  const file = join(root, `${name}.wav`);
  writeFileSync(file, wav(normalize(crossfade(build()))));
  console.log(file);
}
