// Generates transparent browser-tab + clock icons without image dependencies.
// Geometry uses a 16-unit grid to keep the toolbar size legible. Run `npm run icons`.
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
  const inRounded = (x, y, left, top, right, bottom, radius) => {
    const cx = Math.min(Math.max(x, left + radius), right - radius);
    const cy = Math.min(Math.max(y, top + radius), bottom - radius);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  };
  const distSeg = (x, y, x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
  };

  // A raised tab joins the window. The clock overlaps the lower-right corner;
  // its blue rim preserves the silhouette against both light and dark chrome.
  const colorAt = (x, y) => {
    let color = null;
    const window = inRounded(x, y, 1, 4, 14, 14, 1.5);
    const tab = inRounded(x, y, 2, 1, 9, 7, 1.2);
    if (window || tab) color = BG;
    // A short tab label and browser toolbar rule distinguish this from a folder.
    if (distSeg(x, y, 4, 3, 6.5, 3) <= 0.5) color = FG;
    if (distSeg(x, y, 2.5, 6, 12.5, 6) <= 0.5) color = FG;
    const clockDistance = Math.hypot(x - 10, y - 10);
    if (clockDistance <= 5) color = BG;
    if (clockDistance <= 3.8) color = FG;
    // Two thick, round-ended hands remain distinct at 16px.
    if (distSeg(x, y, 10, 7.5, 10, 10) <= 0.6 || distSeg(x, y, 10, 10, 12, 11) <= 0.6) color = BG;
    return color;
  };

  const SS = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let covered = 0;
      const rgb = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const color = colorAt(
            ((x + (sx + 0.5) / SS) * 16) / size,
            ((y + (sy + 0.5) / SS) * 16) / size,
          );
          if (!color) continue;
          covered++;
          for (let c = 0; c < 3; c++) rgb[c] += color[c];
        }
      }
      const i = (y * size + x) * 4;
      // Average only covered samples, keeping transparent edges free of halos.
      for (let c = 0; c < 3; c++) px[i + c] = covered ? Math.round(rgb[c] / covered) : 0;
      px[i + 3] = Math.round((covered / (SS * SS)) * 255);
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
