import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paint(x, y, size);
      const index = row + 1 + x * 4;
      raw[index] = r;
      raw[index + 1] = g;
      raw[index + 2] = b;
      raw[index + 3] = a;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function mix(from, to, amount) {
  const t = Math.max(0, Math.min(1, amount));
  return from.map((channel, index) => Math.round(channel + (to[index] - channel) * t));
}

function roundedRectDistance(x, y, left, top, width, height, radius) {
  const dx = Math.abs(x - (left + width / 2)) - (width / 2 - radius);
  const dy = Math.abs(y - (top + height / 2)) - (height / 2 - radius);
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - radius;
}

function segmentDistance(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function coverage(distance) {
  return Math.max(0, Math.min(1, 0.5 - distance));
}

function paint(maskable) {
  return (x, y, size) => {
    const background = [2, 6, 23, 255];
    const inset = maskable ? 0.2 : 0.09;
    const left = size * inset;
    const top = size * inset;
    const box = size * (1 - inset * 2);
    const radius = box * (14 / 52);
    const shape = roundedRectDistance(x + 0.5, y + 0.5, left, top, box, box, radius);
    const gradient = mix([6, 182, 212], [99, 102, 241], (x + y) / (size * 2));
    const tile = shape < 0.5 ? mix(background, [...gradient, 255], coverage(shape)).concat(255).slice(0, 4) : background;
    const scale = size / 64;
    const stroke = segmentDistance(x + 0.5, y + 0.5, 22 * scale, 33.5 * scale, 28.5 * scale, 40 * scale);
    const stroke2 = segmentDistance(x + 0.5, y + 0.5, 28.5 * scale, 40 * scale, 43 * scale, 24 * scale);
    const mark = Math.min(stroke, stroke2) - 2.25 * scale;
    const ink = coverage(mark);
    if (ink <= 0) return tile;
    return mix(tile, [2, 6, 23, 255], ink);
  };
}

const outputs = [
  ["public/icons/icon-192.png", 192, false],
  ["public/icons/icon-512.png", 512, false],
  ["public/icons/icon-maskable-192.png", 192, true],
  ["public/icons/icon-maskable-512.png", 512, true],
  ["public/apple-touch-icon.png", 180, false],
];

for (const [file, size, maskable] of outputs) {
  const target = join(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, png(size, paint(maskable)));
}
