// generate_icons.js — 독일 국기 PNG 아이콘 생성 (외부 패키지 불필요)
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 ──────────────────────────────────────────────────────────
const _crc = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = _crc[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG chunk helper ───────────────────────────────────────────────
function pngChunk(type, data) {
  const t   = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const crc = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

// ── 독일 국기 PNG 생성 ─────────────────────────────────────────────
function generateFlagPNG(size) {
  const radius = Math.round(size * 0.18); // 둥근 모서리 반지름
  const rowLen = 1 + size * 4;            // 필터 바이트 + RGBA
  const raw    = Buffer.alloc(size * rowLen);

  // 스트라이프 색상 (독일 국기: 검정 / 빨강 / 금색)
  const STRIPES = [
    [0x1a, 0x1a, 0x1a], // 검정
    [0xDD, 0x00, 0x00], // 빨강
    [0xFF, 0xCE, 0x00], // 금색
  ];

  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // PNG filter: None

    const stripe = Math.min(2, Math.floor(y * 3 / size));
    const [R, G, B] = STRIPES[stripe];

    for (let x = 0; x < size; x++) {
      // 알파 계산 (둥근 모서리)
      let alpha = 255;
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      if (cx < radius && cy < radius) {
        const d = Math.hypot(radius - cx, radius - cy);
        if      (d > radius)        alpha = 0;
        else if (d > radius - 1.5)  alpha = Math.round((radius - d) / 1.5 * 255);
      }

      const off = y * rowLen + 1 + x * 4;
      raw[off] = R; raw[off + 1] = G; raw[off + 2] = B; raw[off + 3] = alpha;
    }
  }

  // IHDR 헤더
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 6; // color type: RGBA
  ihdr[10] = ihdr[11] = ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── 생성 ──────────────────────────────────────────────────────────
const iconsDir = path.join(__dirname);
for (const size of [16, 48, 128]) {
  const file = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(file, generateFlagPNG(size));
  console.log(`✓ icon${size}.png`);
}
console.log('Done!');
