/**
 * Generates `public/og.png` — the 1200x630 social share card for LocalMe.
 *
 * Written by hand (zlib + PNG chunks) so the repository needs no image
 * toolchain or binary dependency. Re-run with `node scripts/generate-og.mjs`
 * after changing brand colours or copy.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WIDTH = 1200;
const HEIGHT = 630;

const INK = [11, 18, 32];
const PAPER = [247, 246, 243];
const SIGNAL = [255, 107, 44];
const BLUEPRINT = [56, 189, 248];
const MUTED = [148, 163, 184];

const canvas = new Uint8Array(WIDTH * HEIGHT * 3);

function setPixel(x, y, [r, g, b], alpha = 1) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const index = (y * WIDTH + x) * 3;
  canvas[index] = Math.round(canvas[index] * (1 - alpha) + r * alpha);
  canvas[index + 1] = Math.round(canvas[index + 1] * (1 - alpha) + g * alpha);
  canvas[index + 2] = Math.round(canvas[index + 2] * (1 - alpha) + b * alpha);
}

function fillRect(x, y, w, h, color, alpha = 1) {
  for (let py = Math.max(0, y); py < Math.min(HEIGHT, y + h); py += 1) {
    for (let px = Math.max(0, x); px < Math.min(WIDTH, x + w); px += 1) {
      setPixel(px, py, color, alpha);
    }
  }
}

function radialGlow(cx, cy, radius, color, strength) {
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const d = Math.hypot(x - cx, y - cy) / radius;
      if (d >= 1) continue;
      setPixel(x, y, color, (1 - d) ** 2 * strength);
    }
  }
}

/* ---------------------------------------------------------------- *
 * 5x7 pixel font — a compact geometric face that matches the brand.
 * ---------------------------------------------------------------- */
const GLYPHS = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "11110", "10001", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
  F: ["11111", "10000", "11110", "10000", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "11111", "10001", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "11100", "10010", "10001", "10001", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10011", "01111"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["01110", "10000", "11110", "10001", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "01110", "10001", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "·": ["00000", "00000", "01100", "01100", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function textWidth(text, scale, tracking) {
  return text.length * 5 * scale + (text.length - 1) * tracking * scale;
}

function drawText(text, x, y, scale, color, tracking = 1, alpha = 1) {
  let cursor = x;
  for (const char of text.toUpperCase()) {
    const glyph = GLYPHS[char] ?? GLYPHS[" "];
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        if (glyph[row][col] === "1") {
          fillRect(cursor + col * scale, y + row * scale, scale, scale, color, alpha);
        }
      }
    }
    cursor += (5 + tracking) * scale;
  }
  return cursor;
}

function drawRoundedRect(x, y, w, h, radius, color, alpha = 1) {
  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const dx = px < radius ? radius - px : px >= w - radius ? px - (w - radius - 1) : 0;
      const dy = py < radius ? radius - py : py >= h - radius ? py - (h - radius - 1) : 0;
      if (dx && dy && Math.hypot(dx, dy) > radius) continue;
      setPixel(x + px, y + py, color, alpha);
    }
  }
}

/* ---------------------------------------------------------------- *
 * Compose the card.
 * ---------------------------------------------------------------- */
fillRect(0, 0, WIDTH, HEIGHT, INK);

// Drafting grid.
for (let x = 0; x < WIDTH; x += 40) fillRect(x, 0, 1, HEIGHT, BLUEPRINT, 0.09);
for (let y = 0; y < HEIGHT; y += 40) fillRect(0, y, WIDTH, 1, BLUEPRINT, 0.09);

radialGlow(250, 120, 560, SIGNAL, 0.5);
radialGlow(1080, 560, 460, BLUEPRINT, 0.4);

// Brand mark: ink tile with the signal-orange L and blueprint node.
drawRoundedRect(88, 74, 76, 76, 18, PAPER, 0.08);
drawRoundedRect(88, 74, 76, 76, 18, INK, 0.2);
fillRect(108, 96, 9, 40, SIGNAL);
fillRect(108, 127, 32, 9, SIGNAL);
fillRect(148, 94, 12, 12, BLUEPRINT);
drawText("LOCALME", 186, 92, 14, PAPER, 1);

// Headline.
drawText("SHIP THE APP.", 88, 226, 18, PAPER, 1);
drawText("SKIP THE BACKEND.", 88, 366, 18, SIGNAL, 1);

// Sub-line.
drawText("HTML · CSS · JAVASCRIPT + A MANAGED API", 88, 520, 4, MUTED, 2);

const badge = "DATABASE · STORAGE · AUTH · ROUTING · SECRETS · CRON";
const badgeWidth = textWidth(badge, 3, 2) + 44;
drawRoundedRect(88, 566, badgeWidth, 46, 23, SIGNAL, 0.16);
drawRoundedRect(88, 566, badgeWidth, 46, 23, SIGNAL, 0.01);
drawText(badge, 110, 579, 3, SIGNAL, 2);

/* ---------------------------------------------------------------- *
 * PNG encoding.
 * ---------------------------------------------------------------- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // truecolor
const raw = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT);
for (let y = 0; y < HEIGHT; y += 1) {
  raw[y * (WIDTH * 3 + 1)] = 0; // filter: none
  Buffer.from(canvas.buffer, y * WIDTH * 3, WIDTH * 3).copy(raw, y * (WIDTH * 3 + 1) + 1);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../public/og.png");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, png);
console.log(`Wrote ${target} (${WIDTH}x${HEIGHT}, ${(png.length / 1024).toFixed(1)} KB)`);
