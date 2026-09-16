#!/usr/bin/env node
'use strict';

// Generates site/og-image.png (1200x630) with the Node standard library only:
// a tiny PNG writer (zlib + CRC32) and simple shape rasterization.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'site', 'og-image.png');
const WIDTH = 1200;
const HEIGHT = 630;
const BG = [18, 16, 15, 255];
const ACCENT = [245, 80, 54, 255];
const ACCENT2 = [255, 143, 107, 255];
const INK = [248, 248, 247, 255];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function makeCanvas() {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const offset = (y * WIDTH + x) * 4;
      pixels[offset] = BG[0];
      pixels[offset + 1] = BG[1];
      pixels[offset + 2] = BG[2];
      pixels[offset + 3] = BG[3];
    }
  }
  return pixels;
}

function blend(pixels, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const offset = (y * WIDTH + x) * 4;
  const a = Math.max(0, Math.min(1, alpha));
  pixels[offset] = Math.round(pixels[offset] * (1 - a) + color[0] * a);
  pixels[offset + 1] = Math.round(pixels[offset + 1] * (1 - a) + color[1] * a);
  pixels[offset + 2] = Math.round(pixels[offset + 2] * (1 - a) + color[2] * a);
  pixels[offset + 3] = 255;
}

function fillRect(pixels, x0, y0, w, h, color, alpha) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) blend(pixels, x, y, color, alpha);
}

function distanceToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / lengthSquared));
  const cx = x0 + t * dx;
  const cy = y0 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function drawThickLine(pixels, x0, y0, x1, y1, thickness, color) {
  const minX = Math.floor(Math.min(x0, x1) - thickness - 2);
  const maxX = Math.ceil(Math.max(x0, x1) + thickness + 2);
  const minY = Math.floor(Math.min(y0, y1) - thickness - 2);
  const maxY = Math.ceil(Math.max(y0, y1) + thickness + 2);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const distance = distanceToSegment(x + 0.5, y + 0.5, x0, y0, x1, y1);
      if (distance <= thickness / 2 + 0.5) blend(pixels, x, y, color, Math.min(1, thickness / 2 + 0.5 - distance + 0.5));
    }
  }
}

function roundedRect(pixels, x0, y0, w, h, radius, color) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const dx = Math.max(x0 + radius - x, x - (x0 + w - 1 - radius), 0);
      const dy = Math.max(y0 + radius - y, y - (y0 + h - 1 - radius), 0);
      if (dx * dx + dy * dy <= radius * radius) blend(pixels, x, y, color, 1);
    }
  }
}

function main() {
  const pixels = makeCanvas();

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const edge = Math.max(0, 1 - Math.abs((x - y) - 260) / 460);
      if (edge > 0) blend(pixels, x, y, ACCENT, edge * 0.18);
    }
  }
  fillRect(pixels, 0, HEIGHT - 8, WIDTH, 8, ACCENT, 1);
  fillRect(pixels, 0, HEIGHT - 8, Math.floor(WIDTH * 0.55), 8, ACCENT2, 1);

  roundedRect(pixels, 120, 165, 300, 300, 64, ACCENT);

  drawThickLine(pixels, 200, 320, 250, 372, 34, INK);
  drawThickLine(pixels, 250, 372, 350, 262, 34, INK);

  fillRect(pixels, 500, 210, 560, 34, INK, 0.95);
  fillRect(pixels, 500, 285, 470, 26, INK, 0.65);
  fillRect(pixels, 500, 345, 520, 26, INK, 0.45);
  fillRect(pixels, 500, 405, 300, 26, ACCENT2, 0.9);

  for (const [x, y] of [[500, 470], [560, 470], [620, 470]]) {
    roundedRect(pixels, x, y, 44, 44, 10, INK);
    blend(pixels, x + 22, y + 22, BG, 1);
  }

  const png = encodePng(WIDTH, HEIGHT, pixels);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, png);
  process.stdout.write('og image written: site/og-image.png (' + png.length + ' bytes)\n');
}

module.exports = { encodePng, WIDTH, HEIGHT, main };

if (require.main === module) main();
