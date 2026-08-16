// scripts/generate-icons.mjs
//
// Draws the home-screen icons into public/. Run it after changing the artwork:
//
//   node scripts/generate-icons.mjs
//
// The output is committed, so a normal build and deploy never needs this.
// Written against node:zlib rather than an image library on purpose — an icon
// this simple is not worth a dependency, and the drawing lives in one file
// next to the palette it borrows from.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

/** Tailwind slate-900, matching <meta name="theme-color"> and the app chrome. */
const BACKGROUND = [15, 23, 42];

/** Tailwind 400-weight class-block colours: bright enough to read at 32px. */
const INDIGO = [129, 140, 248];
const EMERALD = [52, 211, 153];
const AMBER = [251, 191, 36];
const SKY = [56, 189, 248];
const ROSE = [251, 113, 133];

/**
 * The glyph: three columns of class blocks, i.e. the schedule grid the app is
 * built around, in unit coordinates so it can be drawn at any size.
 */
const BLOCKS = [
  { x: 0.16, y: 0.14, w: 0.2, h: 0.3, color: INDIGO },
  { x: 0.16, y: 0.52, w: 0.2, h: 0.24, color: SKY },
  { x: 0.4, y: 0.14, w: 0.2, h: 0.2, color: EMERALD },
  { x: 0.4, y: 0.42, w: 0.2, h: 0.44, color: AMBER },
  { x: 0.64, y: 0.22, w: 0.2, h: 0.38, color: ROSE },
  { x: 0.64, y: 0.68, w: 0.2, h: 0.18, color: INDIGO },
];

const CORNER_RADIUS = 0.035;

/** Supersampling factor. Edges are hard-tested per sample, then averaged. */
const SS = 4;

function insideRoundedRect(px, py, { x, y, w, h }, radius) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const r = Math.min(radius, w / 2, h / 2);
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

/**
 * @param size    output edge in pixels
 * @param glyphScale  1 fills the tile; maskable icons shrink the glyph so the
 *                    launcher can crop a circle out of it without clipping.
 */
function renderIcon(size, glyphScale = 1) {
  const big = size * SS;
  const samples = new Float32Array(big * big * 3);

  for (let py = 0; py < big; py += 1) {
    for (let px = 0; px < big; px += 1) {
      // Sample at pixel centres, mapped back through the glyph scaling.
      const u = ((px + 0.5) / big - 0.5) / glyphScale + 0.5;
      const v = ((py + 0.5) / big - 0.5) / glyphScale + 0.5;

      let color = BACKGROUND;
      for (const block of BLOCKS) {
        if (insideRoundedRect(u, v, block, CORNER_RADIUS)) {
          color = block.color;
          break;
        }
      }

      const at = (py * big + px) * 3;
      samples[at] = color[0];
      samples[at + 1] = color[1];
      samples[at + 2] = color[2];
    }
  }

  // Box-downsample the supersampled buffer: this is what softens the edges.
  const rgba = new Uint8Array(size * size * 4);
  const perPixel = SS * SS;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const at = ((y * SS + sy) * big + (x * SS + sx)) * 3;
          r += samples[at];
          g += samples[at + 1];
          b += samples[at + 2];
        }
      }
      const out = (y * size + x) * 4;
      rgba[out] = Math.round(r / perPixel);
      rgba[out + 1] = Math.round(g / perPixel);
      rgba[out + 2] = Math.round(b / perPixel);
      rgba[out + 3] = 255; // Opaque throughout: iOS composites alpha on black.
    }
  }
  return rgba;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  // bytes 10-12 stay zero: deflate, adaptive filtering, no interlace.

  // One filter byte (0 = none) in front of every scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, rowStart + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, glyphScale: 1 },
  { file: 'icon-512.png', size: 512, glyphScale: 1 },
  // Android crops maskable icons to whatever shape the launcher uses; only
  // the middle ~80% is guaranteed to survive.
  { file: 'icon-maskable-512.png', size: 512, glyphScale: 0.7 },
  // iOS rounds the corners itself and does not read the manifest.
  { file: 'apple-touch-icon.png', size: 180, glyphScale: 1 },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const { file, size, glyphScale } of TARGETS) {
  writeFileSync(path.join(OUT_DIR, file), encodePng(size, renderIcon(size, glyphScale)));
  console.log(`wrote public/${file} (${size}x${size})`);
}
