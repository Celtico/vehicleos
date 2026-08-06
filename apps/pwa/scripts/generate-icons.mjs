/**
 * Genera los iconos PNG de la PWA sin dependencias externas.
 *
 * Dibuja píxel a píxel un anillo cian-turquesa estilo gauge sobre fondo
 * negro y codifica el PNG a mano (zlib nativo de Node + CRC32).
 *
 * Uso: node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "icons");

// ── Codificación PNG mínima ─────────────────────────────────────

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let crc = -1;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Codifica un buffer RGBA como PNG. */
function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profundidad de bit
  ihdr[9] = 6; // color RGBA
  // Cada fila lleva delante el byte de filtro 0.
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Dibujo del icono ────────────────────────────────────────────

/** Mezcla lineal entre dos colores [r,g,b]. */
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const rOuter = size * 0.36;
  const rInner = size * 0.28;
  const bgTop = [10, 18, 22];
  const bgBottom = [4, 7, 9];
  const accent = [0, 210, 190];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - c;
      const dy = y - c;
      const dist = Math.hypot(dx, dy);
      // Ángulo 0 = arriba, horario; el anillo es un arco de gauge (240°).
      const angle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
      const inArc = angle >= 240 || angle <= 120; // hueco abajo, como un gauge

      // Fondo con degradado vertical sutil.
      let [r, g, b] = mix(bgTop, bgBottom, y / size);

      if (dist <= rOuter && dist >= rInner && inArc) {
        // Anillo con antialias en los bordes.
        const edge = Math.min(dist - rInner, rOuter - dist);
        const alpha = Math.max(0, Math.min(1, edge / (size * 0.01)));
        [r, g, b] = mix([r, g, b], accent, alpha);
      } else if (dist < rInner * 0.55) {
        // Punto central plateado tenue.
        const t = 1 - dist / (rInner * 0.55);
        [r, g, b] = mix([r, g, b], [200, 210, 214], t * 0.25);
      }

      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, drawIcon(size));
  console.log(`Generado ${file}`);
}
