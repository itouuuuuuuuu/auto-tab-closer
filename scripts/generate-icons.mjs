// Generates simple PNG icons without any image dependency: a rounded blue
// square with a white "x" (close) glyph. Run with `npm run icons`.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const SIZES = [16, 32, 48, 128];
const BG = [0x4f, 0x6d, 0xf5];
const FG = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function render(size) {
  const px = new Uint8Array(size * size * 4);
  const r = size * 0.22; // corner radius
  const stroke = Math.max(1.2, size * 0.11);
  const pad = size * 0.3;

  const inRounded = (x, y) => {
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  // distance from point to segment
  const distSeg = (px_, py_, x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((px_ - x1) * dx + (py_ - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px_ - (x1 + t * dx), py_ - (y1 + t * dy));
  };

  const SS = 4; // supersampling
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgCov = 0;
      let fgCov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS;
          const fy = y + (sy + 0.5) / SS;
          if (!inRounded(fx, fy)) continue;
          bgCov++;
          const d1 = distSeg(fx, fy, pad, pad, size - pad, size - pad);
          const d2 = distSeg(fx, fy, size - pad, pad, pad, size - pad);
          if (Math.min(d1, d2) <= stroke / 2) fgCov++;
        }
      }
      const a = bgCov / (SS * SS);
      const f = bgCov ? fgCov / bgCov : 0;
      const i = (y * size + x) * 4;
      px[i] = Math.round(BG[0] * (1 - f) + FG[0] * f);
      px[i + 1] = Math.round(BG[1] * (1 - f) + FG[1] * f);
      px[i + 2] = Math.round(BG[2] * (1 - f) + FG[2] * f);
      px[i + 3] = Math.round(a * 255);
    }
  }
  return px;
}

function encodePng(size, px) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(px.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
for (const size of SIZES) {
  writeFileSync(`public/icons/icon${size}.png`, encodePng(size, render(size)));
  console.log(`wrote public/icons/icon${size}.png`);
}
