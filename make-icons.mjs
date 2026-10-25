// Draws the app icon (a traffic-light pill on teal) as PNGs, with no dependencies.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(size, px) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) px(x, y).forEach((v, i) => { raw[y * (size * 4 + 1) + 1 + x * 4 + i] = v; });
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex("#1f5f4f"), PILL = hex("#f6f7f3"), LIGHTS = [hex("#c4202f"), hex("#d98a00"), hex("#2f8a43")];
// Signed distance to a rounded box centred at (cx, cy)
const sdBox = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
// Colour at a point in unit space (0..1); full-bleed background so iOS can round the corners itself
function colourAt(u, v) {
  if (sdBox(u, v, 0.5, 0.5, 0.17, 0.36, 0.17) > 0) return BG;
  for (let i = 0; i < 3; i++) if (Math.hypot(u - 0.5, v - (0.28 + i * 0.22)) < 0.1) return LIGHTS[i];
  return PILL;
}
function render(size) {
  const S = 4;
  return png(size, (x, y) => {
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
      const c = colourAt((x + (i + 0.5) / S) / size, (y + (j + 0.5) / S) / size);
      r += c[0]; g += c[1]; b += c[2];
    }
    return [r / S / S, g / S / S, b / S / S, 255].map(Math.round);
  });
}
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) writeFileSync(new URL(name, import.meta.url), render(size));
console.log("icons written");
