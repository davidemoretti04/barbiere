// Genera le icone PNG dell'app (forbici bianche su sfondo blu notte) senza dipendenze esterne.
// Uso: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- geometria in coordinate 0..1 ---
const segDist = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
};
function shape(x, y, scale) {
  // trasforma rispetto al centro per l'icona "maskable" (contenuto più piccolo)
  const u = 0.5 + (x - 0.5) / scale;
  const v = 0.5 + (y - 0.5) / scale;
  const ringR = 0.115, ringW = 0.034;
  const r1 = Math.abs(Math.hypot(u - 0.32, v - 0.7) - ringR) < ringW;
  const r2 = Math.abs(Math.hypot(u - 0.68, v - 0.7) - ringR) < ringW;
  const b1 = segDist(u, v, 0.4, 0.6, 0.73, 0.17) < 0.034;
  const b2 = segDist(u, v, 0.6, 0.6, 0.27, 0.17) < 0.034;
  const pivot = Math.hypot(u - 0.5, v - 0.468) < 0.022;
  if (pivot) return 'pivot';
  return r1 || r2 || b1 || b2 ? 'white' : 'bg';
}
const lerp = (a, b, t) => Math.round(a + (b - a) * t);
function render(size, scale) {
  const S = 4;
  return png(size, (px, py) => {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < S; sy++)
      for (let sx = 0; sx < S; sx++) {
        const x = (px + (sx + 0.5) / S) / size;
        const y = (py + (sy + 0.5) / S) / size;
        const s = shape(x, y, scale);
        let c;
        if (s === 'white') c = [255, 255, 255];
        else if (s === 'pivot') c = [229, 57, 53];
        else c = [lerp(44, 20, y), lerp(62, 30, y), lerp(102, 58, y)];
        r += c[0]; g += c[1]; b += c[2];
      }
    const n = S * S;
    return [r / n, g / n, b / n];
  });
}

const files = [
  ['apple-touch-icon.png', 180, 1],
  ['pwa-192.png', 192, 1],
  ['pwa-512.png', 512, 1],
  ['pwa-maskable-512.png', 512, 0.78],
  ['favicon-32.png', 32, 1.1],
];
for (const [name, size, scale] of files) {
  writeFileSync(new URL(name, OUT), render(size, scale));
  console.log('creato', name);
}

writeFileSync(
  new URL('favicon.svg', OUT),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c3e66"/><stop offset="1" stop-color="#141e3a"/></linearGradient></defs>
<rect width="100" height="100" rx="22" fill="url(#g)"/>
<g fill="none" stroke="#fff" stroke-width="6.8" stroke-linecap="round">
<circle cx="32" cy="70" r="11.5"/><circle cx="68" cy="70" r="11.5"/>
<path d="M40 60L73 17M60 60L27 17"/></g>
<circle cx="50" cy="46.8" r="2.4" fill="#e53935"/>
</svg>
`,
);
console.log('creato favicon.svg');
