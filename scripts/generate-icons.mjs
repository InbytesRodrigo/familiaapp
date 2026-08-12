/**
 * Gera os ícones PNG do PWA (FamíliaApp) sem dependências externas.
 * Renderiza um quadrado arredondado com gradiente estilo Instagram e a letra "F".
 *
 * Uso: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// Cores do gradiente estilo Instagram
const STOPS = ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5'].map(hexToRgb);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function gradientAt(t) {
  const x = Math.min(Math.max(t, 0), 1) * (STOPS.length - 1);
  const i = Math.min(Math.floor(x), STOPS.length - 2);
  const f = x - i;
  return STOPS[i].map((c, k) => Math.round(c + (STOPS[i + 1][k] - c) * f));
}

/** True se o ponto (u,v) ∈ [0,1]² pertence à letra "F". */
function isF(u, v) {
  const t = 0.15; // espessura das barras
  const x0 = 0.4;
  const y0 = 0.26;
  const inVertical = u >= x0 && u <= x0 + t && v >= y0 && v <= y0 + 0.48;
  const inTop = u >= x0 && u <= x0 + 0.28 && v >= y0 && v <= y0 + t;
  const inMiddle = u >= x0 && u <= x0 + 0.22 && v >= y0 + 0.18 && v <= y0 + 0.18 + t;
  return inVertical || inTop || inMiddle;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixels) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filtro None
    pixels.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * @param {number} size
 * @param {{ maskable?: boolean }} opts maskable = fundo cheio (sem cantos transparentes)
 */
function render(size, { maskable = false } = {}) {
  const radius = size * 0.22;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let alpha = 1;
      if (!maskable) {
        // Distância ao retângulo arredondado (SDF) com borda suavizada
        const cx = Math.max(radius, Math.min(size - 1 - radius, x));
        const cy = Math.max(radius, Math.min(size - 1 - radius, y));
        const d = Math.hypot(x - cx, y - cy) - radius;
        alpha = Math.min(1, Math.max(0, 0.5 - d));
        if (alpha <= 0) continue;
      }
      const t = (x + y) / (2 * (size - 1));
      const [r, g, b] = gradientAt(t);
      const white = isF(x / size, y / size);
      const idx = (y * size + x) * 4;
      pixels[idx] = white ? 255 : r;
      pixels[idx + 1] = white ? 255 : g;
      pixels[idx + 2] = white ? 255 : b;
      pixels[idx + 3] = Math.round(255 * alpha);
    }
  }
  return encodePng(size, pixels);
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

for (const { file, size, maskable } of targets) {
  writeFileSync(join(OUT_DIR, file), render(size, { maskable }));
  console.log(`✓ ${file} (${size}x${size})`);
}
